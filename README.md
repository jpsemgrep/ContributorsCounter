# Semgrep Contributors Counter

A beautiful, modern web application for counting unique contributors across GitHub and GitLab organizations. **This app is distributed exclusively as a self-contained Docker container for local use.**

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

## Usage (Docker Only)

You can run this app fully locally in a self-contained Docker container. No central hosting required!

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine) installed
- Git (to clone the repository)

### Complete Setup Instructions

1. **Clone the repository**
   ```sh
   git clone https://github.com/jpsemgrep/ContributorsCounter.git
   cd ContributorsCounter/contributors-counter
   ```

2. **Build the Docker image**
   ```sh
   docker build -t contributors-counter .
   ```

3. **Run the container**
   ```sh
   docker run -d -p 8080:80 --name contributors-counter contributors-counter
   ```

4. **Access the application**
   Open [http://localhost:8080](http://localhost:8080) in your browser

### Alternative: Run in Background
To run the container in the background (detached mode):
```sh
docker run -d -p 8080:80 --name contributors-counter contributors-counter
```

### Stop and Remove the Container
When you're done, you can stop and remove the container:
```sh
docker stop contributors-counter
docker rm contributors-counter
```

### How it Works
- The app is built and served as static files using nginx inside the container.
- All API calls are made client-side from your browser; your tokens and data never leave your machine.

### Customization
You can change the port by modifying the `-p` flag (e.g., `-p 3000:80`).

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
