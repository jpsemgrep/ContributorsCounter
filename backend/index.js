import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory job store with enhanced tracking
const jobs = {};

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// API rate limiting
const GITHUB_DELAY = 1000; // 1 second between requests
const GITHUB_BATCH_SIZE = 10; // Process 10 repos at a time
const GITLAB_DELAY = 100; // 100ms between requests (GitLab allows more requests per minute)
const GITLAB_BATCH_SIZE = 20; // Process 20 projects at a time (GitLab is more permissive)

async function fetchWithRateLimit(url, headers, retries = 3, isGitLab = false) {
  const delayTime = isGitLab ? GITLAB_DELAY : GITHUB_DELAY;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers });
      
      if (isGitLab) {
        // GitLab rate limiting
        const remaining = response.headers.get('ratelimit-remaining');
        const resetTime = response.headers.get('ratelimit-reset');
        
        if (response.status === 429 || (response.status === 403 && remaining === '0')) {
          const resetDate = new Date(parseInt(resetTime) * 1000);
          const waitTime = Math.max(resetDate.getTime() - Date.now(), 0) + 1000;
          console.log(`GitLab rate limit hit, waiting ${waitTime}ms until ${resetDate}`);
          await delay(waitTime);
          continue;
        }
      } else {
        // GitHub rate limiting
        const remaining = response.headers.get('x-ratelimit-remaining');
        const resetTime = response.headers.get('x-ratelimit-reset');
        
        if (response.status === 403 && remaining === '0') {
          const resetDate = new Date(parseInt(resetTime) * 1000);
          const waitTime = Math.max(resetDate.getTime() - Date.now(), 0) + 1000;
          console.log(`GitHub rate limit hit, waiting ${waitTime}ms until ${resetDate}`);
          await delay(waitTime);
          continue;
        }
      }
      
      if (!response.ok) {
        const errorMsg = isGitLab 
          ? `GitLab API request failed: ${response.status} ${response.statusText}`
          : `GitHub API request failed: ${response.status} ${response.statusText}`;
        throw new Error(errorMsg);
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Request failed, retrying in ${delayTime}ms...`);
      await delay(delayTime);
    }
  }
}

async function fetchGitHubContributors(org, token, jobId) {
  const job = jobs[jobId];
  
  try {
    // Update job status
    job.status = 'processing';
    job.progress = { repos: 0, totalRepos: 0, currentRepo: '', contributors: 0 };
    
    // Fetch all repositories
    console.log(`Fetching repositories for ${org}...`);
    let repos = [];
    let page = 1;
    const perPage = 100;
    
    while (true) {
      const repoRes = await fetchWithRateLimit(
        `https://api.github.com/orgs/${org}/repos?per_page=${perPage}&page=${page}`,
        { Authorization: `Bearer ${token}` },
        3,
        false // isGitLab = false
      );
      
      const repoData = await repoRes.json();
      repos = repos.concat(repoData);
      
      // Update progress
      job.progress.totalRepos = repos.length;
      job.progress.repos = repos.length;
      
      if (repoData.length < perPage) break;
      page++;
      
      // Small delay between repo list requests
      await delay(500);
    }
    
    if (repos.length === 0) {
      throw new Error('No repositories found for this organization.');
    }
    
    console.log(`Found ${repos.length} repositories, processing commits...`);
    
    const contributorMap = new Map();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sinceDate = ninetyDaysAgo.toISOString();
    
    // Process repositories in batches to avoid overwhelming the API
    for (let i = 0; i < repos.length; i += GITHUB_BATCH_SIZE) {
      const batch = repos.slice(i, i + GITHUB_BATCH_SIZE);
      
      // Process batch in parallel with rate limiting
      const batchPromises = batch.map(async (repo) => {
        job.progress.currentRepo = repo.name;
        
        let cPage = 1;
        let repoContributors = 0;
        
        while (true) {
          try {
            const commitsRes = await fetchWithRateLimit(
              `https://api.github.com/repos/${org}/${repo.name}/commits?per_page=${perPage}&page=${cPage}&since=${sinceDate}`,
              { Authorization: `Bearer ${token}` },
              3,
              false // isGitLab = false
            );
            
            const commitsData = await commitsRes.json();
            
            for (const commit of commitsData) {
              if (commit && commit.author && commit.author.login) {
                const username = commit.author.login;
                if (!contributorMap.has(username)) {
                  contributorMap.set(username, {
                    username: username,
                    name: commit.commit.author.name || username,
                    email: commit.commit.author.email || '',
                    contributions: 0,
                    avatar_url: commit.author.avatar_url
                  });
                }
                contributorMap.get(username).contributions += 1;
                repoContributors++;
              }
            }
            
            if (commitsData.length < perPage) break;
            cPage++;
            
            // Rate limiting delay
            await delay(GITHUB_DELAY);
            
          } catch (error) {
            console.log(`Error fetching commits for ${repo.name}: ${error.message}`);
            break; // Skip this repo if there's an error
          }
        }
        
        return repoContributors;
      });
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Update progress
      job.progress.repos = Math.min(i + GITHUB_BATCH_SIZE, repos.length);
      job.progress.contributors = contributorMap.size;
      
      // Delay between batches
      await delay(GITHUB_DELAY * 2);
    }
    
    const contributorList = Array.from(contributorMap.values())
      .sort((a, b) => b.contributions - a.contributions);
    
    if (contributorList.length === 0) {
      throw new Error('No active contributors found in the last 90 days.');
    }
    
    return contributorList;
    
  } catch (error) {
    console.error(`Error in fetchGitHubContributors: ${error.message}`);
    throw error;
  }
}

async function fetchGitLabContributors(org, token, url, jobId) {
  const job = jobs[jobId];
  
  try {
    // Update job status
    job.status = 'processing';
    job.progress = { projects: 0, totalProjects: 0, currentProject: '', contributors: 0 };
    
    // Fetch all projects
    console.log(`Fetching projects for ${org}...`);
    let projects = [];
    let page = 1;
    const perPage = 100;
    
    while (true) {
      try {
        const projRes = await fetchWithRateLimit(
          `${url}/api/v4/groups/${encodeURIComponent(org)}/projects?per_page=${perPage}&page=${page}`,
          { 'PRIVATE-TOKEN': token },
          3,
          true // isGitLab = true
        );
        
        const projData = await projRes.json();
        projects = projects.concat(projData);
        
        // Update progress
        job.progress.totalProjects = projects.length;
        job.progress.projects = projects.length;
        
        if (projData.length < perPage) break;
        page++;
        
        // Small delay between project list requests
        await delay(GITLAB_DELAY);
        
      } catch (error) {
        console.log(`Error fetching project list page ${page}: ${error.message}`);
        break; // Stop if we can't fetch more projects
      }
    }
    
    if (projects.length === 0) {
      throw new Error('No projects found for this group. Please check the group name, URL, and your token permissions.');
    }
    
    console.log(`Found ${projects.length} projects, processing commits...`);
    
    const contributorMap = new Map();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sinceDate = ninetyDaysAgo.toISOString();
    
    // Process projects in batches to avoid overwhelming the API
    for (let i = 0; i < projects.length; i += GITLAB_BATCH_SIZE) {
      const batch = projects.slice(i, i + GITLAB_BATCH_SIZE);
      
      // Process batch in parallel with rate limiting
      const batchPromises = batch.map(async (project) => {
        job.progress.currentProject = project.name;
        
        let cPage = 1;
        let projectContributors = 0;
        
        while (true) {
          try {
            const commitsRes = await fetchWithRateLimit(
              `${url}/api/v4/projects/${project.id}/repository/commits?per_page=${perPage}&page=${cPage}&since=${sinceDate}`,
              { 'PRIVATE-TOKEN': token },
              3,
              true // isGitLab = true
            );
            
            const commitsData = await commitsRes.json();
            
            for (const commit of commitsData) {
              if (commit && commit.author_email) {
                const email = commit.author_email;
                const name = commit.author_name || email;
                const key = email;
                
                if (!contributorMap.has(key)) {
                  contributorMap.set(key, {
                    username: name,
                    name: name,
                    email: email,
                    contributions: 0
                  });
                }
                contributorMap.get(key).contributions += 1;
                projectContributors++;
              }
            }
            
            if (commitsData.length < perPage) break;
            cPage++;
            
            // Rate limiting delay
            await delay(GITLAB_DELAY);
            
          } catch (error) {
            // Handle specific GitLab errors
            if (error.message.includes('404')) {
              console.log(`Project ${project.name} not accessible or doesn't exist`);
            } else if (error.message.includes('403')) {
              console.log(`Access denied to project ${project.name} - insufficient permissions`);
            } else if (error.message.includes('429')) {
              console.log(`Rate limit hit while processing ${project.name}, continuing...`);
            } else {
              console.log(`Error fetching commits for ${project.name}: ${error.message}`);
            }
            break; // Skip this project if there's an error
          }
        }
        
        return projectContributors;
      });
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Update progress
      job.progress.projects = Math.min(i + GITLAB_BATCH_SIZE, projects.length);
      job.progress.contributors = contributorMap.size;
      
      // Delay between batches
      await delay(GITLAB_DELAY * 2);
    }
    
    const contributorList = Array.from(contributorMap.values())
      .sort((a, b) => b.contributions - a.contributions);
    
    if (contributorList.length === 0) {
      throw new Error('No active contributors found in the last 90 days. This could be due to insufficient permissions or no recent activity.');
    }
    
    return contributorList;
    
  } catch (error) {
    console.error(`Error in fetchGitLabContributors: ${error.message}`);
    
    // Provide more specific error messages for common GitLab issues
    if (error.message.includes('404')) {
      throw new Error('Group not found. Please check the group name and ensure it exists.');
    } else if (error.message.includes('403')) {
      throw new Error('Access denied. Please check your token permissions and ensure you have access to this group.');
    } else if (error.message.includes('401')) {
      throw new Error('Invalid token. Please check your GitLab personal access token.');
    } else if (error.message.includes('422')) {
      throw new Error('Invalid group name or URL. Please check your input.');
    }
    
    throw error;
  }
}

// Start a new contributor count job
app.post('/api/start', async (req, res) => {
  const { org, platform, token, url } = req.body;
  const jobId = uuidv4();
  
  jobs[jobId] = {
    status: 'pending',
    result: null,
    org,
    platform,
    started: Date.now(),
    error: null,
    progress: { repos: 0, totalRepos: 0, currentRepo: '', contributors: 0 }
  };
  
  // Start async work
  (async () => {
    try {
      let contributors = [];
      if (platform === 'github') {
        contributors = await fetchGitHubContributors(org, token, jobId);
      } else if (platform === 'gitlab') {
        contributors = await fetchGitLabContributors(org, token, url, jobId);
      } else {
        throw new Error('Unknown platform');
      }
      
      jobs[jobId].status = 'complete';
      jobs[jobId].result = { contributors, org, platform };
      jobs[jobId].progress = null; // Clear progress when complete
      
    } catch (err) {
      jobs[jobId].status = 'error';
      jobs[jobId].error = err.message || 'Unknown error';
      jobs[jobId].progress = null; // Clear progress on error
    }
  })();
  
  res.json({ jobId });
});

// Check job status with progress
app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json({ 
    status: job.status, 
    error: job.error,
    progress: job.progress
  });
});

// Get job result
app.get('/api/result/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.status !== 'complete') {
    return res.status(202).json({ 
      status: job.status, 
      error: job.error,
      progress: job.progress
    });
  }
  
  res.json({ result: job.result });
});

app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
}); 