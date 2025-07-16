# Semgrep Contributors Counter

A beautiful, modern web application for counting unique contributors across GitHub and GitLab organizations. **This app now uses a two-container architecture: a backend API and a frontend UI, orchestrated by Docker Compose.**

## Features

- **GitHub Integration**: Count unique contributors across all repositories in a GitHub organization
- **GitLab Integration**: Count unique contributors across all projects in a GitLab group
- **Export Functionality**: Export contributor lists as CSV or PDF with detailed information
- **Responsive Design**: Beautiful, modern UI that works on desktop and mobile
- **Secure**: Token-based authentication with show/hide functionality
- **Real-time**: Live contributor counting with pagination support

## Architecture

- **Backend API**: Handles all logic for fetching contributors from GitHub and GitLab. Exposes endpoints to start a job, check status, and get results. Runs in its own container.
- **Frontend UI**: React app that takes user input, starts jobs via the backend API, polls for status, and displays results. Runs in its own container.
- **Docker Compose**: Orchestrates both containers for easy local setup.

## Usage (Docker Compose)

You can run this app fully locally using Docker Compose. No central hosting required!

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine) installed
- [Docker Compose](https://docs.docker.com/compose/) (comes with Docker Desktop)
- Git (to clone the repository)

### Complete Setup Instructions

1. **Clone the repository**
   ```sh
   git clone https://github.com/jpsemgrep/ContributorsCounter.git
   cd ContributorsCounter
   ```

2. **Build and run both containers**
   ```sh
   docker-compose up --build
   ```
   This will build and start both the backend API and frontend UI containers.

3. **Access the application**
   Open [http://localhost:8080](http://localhost:8080) in your browser

4. **Stop the application**
   Press `Ctrl+C` in the terminal, then run:
   ```sh
   docker-compose down
   ```

---

### How it Works
- The frontend React app talks to the backend API at `http://backend:3001` (Docker Compose networking).
- The backend API does all communication with GitHub/GitLab and returns results to the frontend.
- The frontend polls the backend for job status and displays results when ready.
- All API calls are made server-side; your tokens and data never leave your machine.

### Customization
You can change the frontend or backend ports by editing `docker-compose.yml`.

---

### GitHub Setup

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with the following scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (Read organization data)
3. Enter your organization name and the generated token in the app

### GitLab Setup

1. Go to GitLab User Settings > Access Tokens
2. Create a new token with `read_api` scope
3. Enter your group name, GitLab instance URL, and the generated token in the app

### Exporting Data

After counting contributors, you can:
- **Export CSV**: Download a comma-separated file with contributor details
- **Export PDF**: Generate a professional PDF report with contributor information

---

## Security Considerations

- **Token Storage**: Tokens are stored only in browser memory and are not persisted
- **HTTPS**: Always use HTTPS in production to protect token transmission
- **CORS**: The backend API handles CORS for local development
- **Rate Limiting**: Be aware of API rate limits for large organizations

## API Endpoints Used

### GitHub
- `GET /orgs/{org}/repos` - List organization repositories
- `GET /repos/{owner}/{repo}/commits` - List repository commits

### GitLab
- `GET /api/v4/groups/{group}/projects` - List group projects
- `GET /api/v4/projects/{id}/repository/commits` - List project commits

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.

---
