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
import semgrepLogo from './assets/semgrep-icon-text-horizontal.svg';

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
      // 1. Start job on backend
      const { data: startData } = await axios.post(
        'http://backend:3001/api/start',
        { org: ghOrg, platform: 'github', token: ghToken }
      );
      const jobId = startData.jobId;
      // 2. Poll for status
      let status = 'pending';
      let pollError = null;
      while (status === 'pending') {
        await new Promise(r => setTimeout(r, 2000));
        const { data: statusData } = await axios.get(`http://backend:3001/api/status/${jobId}`);
        status = statusData.status;
        pollError = statusData.error;
        if (status === 'error') throw new Error(pollError || 'Unknown error');
      }
      // 3. Get result
      const { data: resultData } = await axios.get(`http://backend:3001/api/result/${jobId}`);
      const contributorList = resultData.result.contributors;
      if (!contributorList || contributorList.length === 0) throw new Error('No active contributors found in the last 90 days.');
      setContributors(contributorList);
      setResult(contributorList.length);
    } catch (err) {
      let msg = err.message || 'Failed to fetch contributors.';
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
      // 1. Start job on backend
      const { data: startData } = await axios.post(
        'http://backend:3001/api/start',
        { org: glOrg, platform: 'gitlab', token: glToken, url: glUrl }
      );
      const jobId = startData.jobId;
      // 2. Poll for status
      let status = 'pending';
      let pollError = null;
      while (status === 'pending') {
        await new Promise(r => setTimeout(r, 2000));
        const { data: statusData } = await axios.get(`http://backend:3001/api/status/${jobId}`);
        status = statusData.status;
        pollError = statusData.error;
        if (status === 'error') throw new Error(pollError || 'Unknown error');
      }
      // 3. Get result
      const { data: resultData } = await axios.get(`http://backend:3001/api/result/${jobId}`);
      const contributorList = resultData.result.contributors;
      if (!contributorList || contributorList.length === 0) throw new Error('No active contributors found in the last 90 days.');
      setContributors(contributorList);
      setResult(contributorList.length);
    } catch (err) {
      let msg = err.message || 'Failed to fetch contributors.';
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
          <img src={semgrepLogo} alt="Semgrep Logo" style={{ width: isSmall ? 150 : 260, height: isSmall ? 150 : 260, marginBottom: isSmall ? -50 : -60, marginTop: isSmall ? -10 : -15 }} />
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
