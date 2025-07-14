import { useState } from 'react';
import axios from 'axios';
import { Box, Tabs, Tab, Typography, TextField, Button, Paper, CircularProgress, Alert, Tooltip, Grid, IconButton, InputAdornment, useMediaQuery, Stack, Card, CardContent } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import GitlabIcon from '@mui/icons-material/AccountTree';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useTheme } from '@mui/material/styles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import './App.css';
import semgrepLogo from './assets/semgrep-logo.svg'

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: { xs: 1, md: 3 } }}>{children}</Box>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(0);
  // GitHub state
  const [ghOrg, setGhOrg] = useState('');
  const [ghUrl, setGhUrl] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [ghShowToken, setGhShowToken] = useState(false);
  // GitLab state
  const [glOrg, setGlOrg] = useState('');
  const [glUrl, setGlUrl] = useState('');
  const [glToken, setGlToken] = useState('');
  const [glShowToken, setGlShowToken] = useState(false);
  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [currentOrg, setCurrentOrg] = useState('');

  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('md'));

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setError('');
    setResult(null);
    setContributors([]);
  };

  // Helper function to check if date is within last 90 days
  const isWithinLast90Days = (dateString) => {
    const commitDate = new Date(dateString);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return commitDate >= ninetyDaysAgo;
  };

  // Export functions
  const exportToCSV = () => {
    if (!contributors.length) return;
    
    const headers = ['Username', 'Name', 'Email', 'Contributions (Last 90 Days)'];
    const csvContent = [
      headers.join(','),
      ...contributors.map(c => [
        c.username || '',
        c.name || '',
        c.email || '',
        c.contributions || 0
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${currentOrg}_active_contributors_90days.csv`);
  };

  const exportToPDF = () => {
    if (!contributors.length) return;
    
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(`${currentOrg} - Active Contributors Report`, 14, 22);
    
    // Subtitle
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Active Contributors (Last 90 Days): ${contributors.length}`, 14, 42);
    
    // Table
    const tableData = contributors.map(c => [
      c.username || '',
      c.name || '',
      c.email || '',
      c.contributions || 0
    ]);
    
    autoTable(doc, {
      head: [['Username', 'Name', 'Email', 'Contributions (Last 90 Days)']],
      body: tableData,
      startY: 50,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [25, 118, 210],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
    });
    
    doc.save(`${currentOrg}_active_contributors_90days.pdf`);
  };

  // --- GitHub Logic ---
  const handleGitHubSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setContributors([]);
    setCurrentOrg(ghOrg);
    
    try {
      // 1. Get all repos for the org (paginated)
      let repos = [];
      let page = 1;
      const perPage = 100;
      while (true) {
        const repoRes = await axios.get(`https://api.github.com/orgs/${ghOrg}/repos`, {
          headers: { Authorization: `Bearer ${ghToken}` },
          params: { per_page: perPage, page },
        });
        repos = repos.concat(repoRes.data);
        if (repoRes.data.length < perPage) break;
        page++;
      }
      if (repos.length === 0) throw new Error('No repositories found for this organization. Please check the organization name and your token permissions.');
      
      // 2. For each repo, get commits from the last 90 days and track contributors
      const contributorMap = new Map();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const sinceDate = ninetyDaysAgo.toISOString();
      
      for (const repo of repos) {
        let cPage = 1;
        while (true) {
          const commitsRes = await axios.get(`https://api.github.com/repos/${ghOrg}/${repo.name}/commits`, {
            headers: { Authorization: `Bearer ${ghToken}` },
            params: { 
              per_page: perPage, 
              page: cPage,
              since: sinceDate
            },
          });
          
          for (const commit of commitsRes.data) {
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
            }
          }
          
          if (commitsRes.data.length < perPage) break;
          cPage++;
        }
      }
      
      const contributorList = Array.from(contributorMap.values()).sort((a, b) => b.contributions - a.contributions);
      if (contributorList.length === 0) throw new Error('No active contributors found in the last 90 days.');
      setContributors(contributorList);
      setResult(contributorList.length);
    } catch (err) {
      let msg = 'Failed to fetch contributors.';
      if (err.response) {
        if (err.response.status === 401) {
          msg = 'Invalid or expired GitHub token. Please check your token and try again.';
        } else if (err.response.status === 403) {
          msg = 'Access denied. Your token may lack the required scopes (repo, read:org) or you have hit the GitHub API rate limit.';
        } else if (err.response.status === 404) {
          msg = 'Organization or repository not found. Please check the organization name and your token permissions.';
        } else if (err.response.data && err.response.data.message) {
          msg = `GitHub API error: ${err.response.data.message}`;
        }
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- GitLab Logic ---
  const handleGitLabSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setContributors([]);
    setCurrentOrg(glOrg);
    
    try {
      // 1. Get all projects for the group/org (paginated)
      let projects = [];
      let page = 1;
      const perPage = 100;
      while (true) {
        const projRes = await axios.get(`${glUrl}/api/v4/groups/${encodeURIComponent(glOrg)}/projects`, {
          headers: { 'PRIVATE-TOKEN': glToken },
          params: { per_page: perPage, page },
        });
        projects = projects.concat(projRes.data);
        if (projRes.data.length < perPage) break;
        page++;
      }
      if (projects.length === 0) throw new Error('No projects found for this group. Please check the group name and your token permissions.');
      
      // 2. For each project, get commits from the last 90 days and track contributors
      const contributorMap = new Map();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const sinceDate = ninetyDaysAgo.toISOString();
      
      for (const project of projects) {
        let cPage = 1;
        while (true) {
          const commitsRes = await axios.get(`${glUrl}/api/v4/projects/${project.id}/repository/commits`, {
            headers: { 'PRIVATE-TOKEN': glToken },
            params: { 
              per_page: perPage, 
              page: cPage,
              since: sinceDate
            },
          });
          
          for (const commit of commitsRes.data) {
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
            }
          }
          
          if (commitsRes.data.length < perPage) break;
          cPage++;
        }
      }
      
      const contributorList = Array.from(contributorMap.values()).sort((a, b) => b.contributions - a.contributions);
      if (contributorList.length === 0) throw new Error('No active contributors found in the last 90 days.');
      setContributors(contributorList);
      setResult(contributorList.length);
    } catch (err) {
      let msg = 'Failed to fetch contributors.';
      if (err.response) {
        if (err.response.status === 401) {
          msg = 'Invalid or expired GitLab token. Please check your token and try again.';
        } else if (err.response.status === 403) {
          msg = 'Access denied. Your token may lack the required scope (read_api) or you have hit the GitLab API rate limit.';
        } else if (err.response.status === 404) {
          msg = 'Group or project not found. Please check the group name, URL, and your token permissions.';
        } else if (err.response.data && err.response.data.message) {
          msg = `GitLab API error: ${err.response.data.message}`;
        }
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Token visibility toggles
  const handleGhShowTokenToggle = () => setGhShowToken((show) => !show);
  const handleGlShowTokenToggle = () => setGlShowToken((show) => !show);

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100vw',
      bgcolor: '#f5f7fa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'auto',
    }}>
      <Paper elevation={4} sx={{
        p: { xs: 2, md: 5 },
        borderRadius: 4,
        width: { xs: '98vw', sm: '90vw', md: '70vw', lg: '60vw', xl: '50vw' },
        maxWidth: 1000,
        minWidth: { xs: 'unset', md: 700 },
        mt: { xs: 2, md: 6 },
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <img src={semgrepLogo} alt="Semgrep Logo" style={{ width: 72, height: 72, marginBottom: 8 }} />
          <Typography variant={isSmall ? 'h4' : 'h3'} align="center" gutterBottom sx={{ fontWeight: 700, mb: 1, letterSpacing: '-1px' }}>
            Contributors Counter
          </Typography>
        </Box>
        <Typography variant="subtitle1" align="center" sx={{ mb: 3, color: 'text.secondary' }}>
          Count unique contributors active in the last 90 days
        </Typography>
        <Tabs value={tab} onChange={handleTabChange} centered sx={{ mb: 3, width: '100%' }}>
          <Tab icon={<GitHubIcon />} label="GitHub" />
          <Tab icon={<GitlabIcon />} label="GitLab" />
        </Tabs>
        <TabPanel value={tab} index={0}>
          <Card sx={{ mb: 3, background: '#f5f7fa', border: '1px solid #e3e8ee', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                GitHub Setup Instructions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                1. Go to <b>GitHub Settings &gt; Developer settings &gt; Personal access tokens</b>.<br/>
                2. Click <b>Generate new token</b>.<br/>
                3. Name your token and set an expiration.<br/>
                4. Select the following scopes:<br/>
                <span style={{ marginLeft: 16 }}><b>repo</b> (for private repos)</span><br/>
                <span style={{ marginLeft: 16 }}><b>read:org</b> (for organization data)</span><br/>
                5. Click <b>Generate token</b> and copy it.<br/>
                6. Paste the token below.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                For public orgs only, <b>public_repo</b> and <b>read:org</b> are sufficient.
              </Typography>
            </CardContent>
          </Card>
          <Grid container spacing={3} justifyContent="center" alignItems="center">
            <Grid item xs={12} md={4} display="flex" justifyContent="center">
              <TextField
                label="GitHub Org Name"
                variant="outlined"
                fullWidth
                value={ghOrg}
                onChange={e => setGhOrg(e.target.value)}
                sx={{ maxWidth: 350 }}
              />
            </Grid>
            <Grid item xs={12} md={5} display="flex" justifyContent="center">
              <TextField
                label="GitHub Org URL"
                variant="outlined"
                fullWidth
                value={ghUrl}
                onChange={e => setGhUrl(e.target.value)}
                sx={{ maxWidth: 400 }}
              />
            </Grid>
            <Grid item xs={12} md={3} display="flex" justifyContent="center">
              <Tooltip title="A GitHub Personal Access Token is required for API access. It must have 'repo' and 'read:org' scopes.">
                <TextField
                  label={<span>GitHub Token <InfoOutlinedIcon fontSize='small' sx={{ verticalAlign: 'middle' }} /></span>}
                  variant="outlined"
                  type={ghShowToken ? 'text' : 'password'}
                  fullWidth
                  value={ghToken}
                  onChange={e => setGhToken(e.target.value)}
                  sx={{ maxWidth: 300 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleGhShowTokenToggle} edge="end" size="small">
                          {ghShowToken ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Tooltip>
            </Grid>
            <Grid item xs={12} display="flex" justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                size="large"
                sx={{ mt: 1, minWidth: 220, fontSize: '1.1rem' }}
                onClick={handleGitHubSubmit}
                disabled={loading || !ghOrg || !ghUrl || !ghToken}
              >
                Count Active Contributors
              </Button>
            </Grid>
          </Grid>
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <Card sx={{ mb: 3, background: '#f5f7fa', border: '1px solid #e3e8ee', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                GitLab Setup Instructions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                1. Go to <b>GitLab User Settings &gt; Access Tokens</b>.<br/>
                2. Click <b>Create personal access token</b>.<br/>
                3. Name your token and set an expiration.<br/>
                4. Select the following scope:<br/>
                <span style={{ marginLeft: 16 }}><b>read_api</b></span><br/>
                5. Click <b>Create personal access token</b> and copy it.<br/>
                6. Paste the token below.
              </Typography>
            </CardContent>
          </Card>
          <Grid container spacing={3} justifyContent="center" alignItems="center">
            <Grid item xs={12} md={4} display="flex" justifyContent="center">
              <TextField
                label="GitLab Org Name"
                variant="outlined"
                fullWidth
                value={glOrg}
                onChange={e => setGlOrg(e.target.value)}
                sx={{ maxWidth: 350 }}
              />
            </Grid>
            <Grid item xs={12} md={5} display="flex" justifyContent="center">
              <TextField
                label="GitLab Org URL"
                variant="outlined"
                fullWidth
                value={glUrl}
                onChange={e => setGlUrl(e.target.value)}
                sx={{ maxWidth: 400 }}
              />
            </Grid>
            <Grid item xs={12} md={3} display="flex" justifyContent="center">
              <Tooltip title="A GitLab Personal Access Token is required for API access. It must have 'read_api' scope.">
                <TextField
                  label={<span>GitLab Token <InfoOutlinedIcon fontSize='small' sx={{ verticalAlign: 'middle' }} /></span>}
                  variant="outlined"
                  type={glShowToken ? 'text' : 'password'}
                  fullWidth
                  value={glToken}
                  onChange={e => setGlToken(e.target.value)}
                  sx={{ maxWidth: 300 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleGlShowTokenToggle} edge="end" size="small">
                          {glShowToken ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Tooltip>
            </Grid>
            <Grid item xs={12} display="flex" justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                size="large"
                sx={{ mt: 1, minWidth: 220, fontSize: '1.1rem' }}
                onClick={handleGitLabSubmit}
                disabled={loading || !glOrg || !glUrl || !glToken}
              >
                Count Active Contributors
              </Button>
            </Grid>
          </Grid>
        </TabPanel>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress size={40} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>
        )}
        {result && !loading && (
          <Box sx={{ mt: 5, textAlign: 'center', width: '100%' }}>
            <Typography variant="h5" sx={{ fontWeight: 500 }}>Active Contributors (Last 90 Days):</Typography>
            <Typography variant="h2" color="primary" sx={{ fontWeight: 700, mb: 3 }}>{result}</Typography>
            
            {contributors.length > 0 && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<TableChartIcon />}
                  onClick={exportToCSV}
                  sx={{ minWidth: 160 }}
                >
                  Export CSV
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PictureAsPdfIcon />}
                  onClick={exportToPDF}
                  sx={{ minWidth: 160 }}
                >
                  Export PDF
                </Button>
              </Stack>
            )}
          </Box>
        )}
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        &copy; {new Date().getFullYear()} Semgrep
      </Typography>
    </Box>
  );
}
