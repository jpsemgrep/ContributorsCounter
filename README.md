# Semgrep Contributors Counter

A beautiful, modern web application for counting unique contributors across GitHub and GitLab organizations. Built with React, Material-UI, and Vite.

## Features

- **GitHub Integration**: Count unique contributors across all repositories in a GitHub organization
- **GitLab Integration**: Count unique contributors across all projects in a GitLab group
- **Export Functionality**: Export contributor lists as CSV or PDF with detailed information
- **Responsive Design**: Beautiful, modern UI that works on desktop and mobile
- **Secure**: Token-based authentication with show/hide functionality
- **Real-time**: Live contributor counting with pagination support

## Screenshots

The app features a clean, professional interface with:
- Tabbed interface for GitHub and GitLab
- Input fields for organization details and authentication tokens
- Export buttons for CSV and PDF reports
- Responsive design that adapts to any screen size

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ContributorsCounter.git
cd ContributorsCounter
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

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

## Deployment

### GitHub Pages (Recommended)

1. Push your code to a GitHub repository
2. Run the deployment command:
```bash
npm run deploy
```

3. Go to your repository Settings > Pages
4. Set the source to "Deploy from a branch" and select the `gh-pages` branch
5. Your app will be available at `https://yourusername.github.io/ContributorsCounter/`

### Other Hosting Options

The app can be deployed to any static hosting service:
- Netlify
- Vercel
- AWS S3
- Firebase Hosting

## Run Locally as a Docker Container

You can run this app fully locally in a self-contained Docker container. No central hosting required!

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine) installed

### Build the Docker Image
From your project root, run:
```sh
docker build -t contributors-counter .
```

### Run the Container
```sh
docker run -p 8080:80 contributors-counter
```
Then open [http://localhost:8080](http://localhost:8080) in your browser.

### How it Works
- The app is built and served as static files using nginx inside the container.
- All API calls are made client-side from your browser; your tokens and data never leave your machine.

### Customization
You can change the port by modifying the `-p` flag (e.g., `-p 3000:80`).

---

## Security Considerations

- **Token Storage**: Tokens are stored only in browser memory and are not persisted
- **HTTPS**: Always use HTTPS in production to protect token transmission
- **CORS**: The app makes direct API calls to GitHub/GitLab, so CORS policies apply
- **Rate Limiting**: Be aware of API rate limits for large organizations

## API Endpoints Used

### GitHub
- `GET /orgs/{org}/repos` - List organization repositories
- `GET /repos/{owner}/{repo}/contributors` - List repository contributors

### GitLab
- `GET /api/v4/groups/{group}/projects` - List group projects
- `GET /api/v4/projects/{id}/repository/contributors` - List project contributors

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

Built with ❤️ by the Semgrep team
