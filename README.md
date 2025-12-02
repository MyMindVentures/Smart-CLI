# Smart-CLI 🤖

AI-Powered Command Generator & Executor - A fullstack PWA for generating and executing shell commands using AI, designed for no-coders and developers who want to simplify CLI interactions.

## Features

- 🧠 **AI Command Generation**: Generate shell commands from natural language prompts (MVP uses stub, ready for OpenAI integration)
- ⚡ **Safe Execution**: Execute commands in a sandboxed environment with security controls
- 📊 **Real-time Output**: Stream command output via Server-Sent Events
- 📱 **PWA Support**: Install as a Progressive Web App on any device
- 📝 **Execution History**: Track all command executions with logs
- 🔒 **Security First**: Command validation, blacklisting, timeout controls

## Architecture

- **Frontend**: SvelteKit PWA with minimal UI
- **Backend**: Node.js + Express API with command executor
- **Deployment**: Single Docker container, optimized for Railway

## Quick Deploy to Railway

### Prerequisites
- Railway account (https://railway.app)
- GitHub account

### Deploy Steps

1. **Fork this repository** or click "Deploy on Railway" button (if configured)

2. **Create new Railway project**:
   ```bash
   # Install Railway CLI (optional)
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Create new project
   railway init
   ```

3. **Configure Environment Variables** in Railway dashboard:
   ```
   OPENAI_API_KEY=your_api_key_here  # TODO: Add when integrating OpenAI
   NODE_ENV=production
   PORT=3000
   ```

4. **Deploy**:
   - Railway will automatically detect the Dockerfile and deploy
   - Or use Railway CLI: `railway up`

5. **Access your app**:
   - Railway will provide a public URL
   - App will be available at `https://your-app.railway.app`

### Alternative: Docker Deployment

```bash
# Build the Docker image
docker build -t smart-cli .

# Run the container
docker run -p 3000:3000 -e NODE_ENV=production smart-cli

# Access at http://localhost:3000
```

## Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MyMindVentures/Smart-CLI.git
   cd Smart-CLI
   ```

2. **Install dependencies**:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

3. **Start development servers**:
   
   **Terminal 1 - Backend**:
   ```bash
   cd backend
   npm run dev
   ```
   
   **Terminal 2 - Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

4. **Access the app**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Optional: Add when implementing OpenAI integration
OPENAI_API_KEY=your_key_here

# Server configuration
PORT=3000
NODE_ENV=development
```

## Project Structure

```
Smart-CLI/
├── frontend/              # SvelteKit PWA
│   ├── src/
│   │   ├── routes/       # Pages
│   │   └── app.html      # HTML template
│   ├── static/           # Static assets, PWA manifest
│   ├── package.json
│   └── vite.config.js
├── backend/              # Express API server
│   ├── server.js         # Main server file
│   ├── data/            # Execution logs (gitignored)
│   └── package.json
├── shared/              # Shared utilities
│   └── utils.js         # Sanitization and logging
├── sandbox/             # Command execution sandbox (gitignored)
├── .github/
│   └── workflows/       # GitHub Actions CI/CD
├── Dockerfile           # Single container build
├── railway.json         # Railway configuration
└── README.md
```

## API Endpoints

### POST `/api/generate`
Generate a command from a natural language prompt.

**Request**:
```json
{
  "prompt": "list all files in current directory"
}
```

**Response**:
```json
{
  "command": "ls -la",
  "prompt": "list all files in current directory",
  "note": "This is a stub implementation..."
}
```

### POST `/api/execute`
Execute a command in the sandbox (returns SSE stream).

**Request**:
```json
{
  "command": "ls -la"
}
```

**Response** (Server-Sent Events):
```
data: {"type":"stdout","data":"total 8\n"}
data: {"type":"complete","exitCode":0,"duration":123}
```

### GET `/api/logs`
Get execution history.

**Response**:
```json
{
  "logs": [
    {
      "timestamp": "2024-01-01T12:00:00.000Z",
      "command": "ls -la",
      "status": "success",
      "exitCode": 0,
      "output": "...",
      "duration": 123
    }
  ]
}
```

### GET `/api/health`
Health check endpoint.

## Security Features

⚠️ **Important Security Notes**:

1. **Sandbox Execution**: Commands run in `/sandbox` directory with limited access
2. **Command Validation**: Dangerous commands are blacklisted (rm -rf /, shutdown, etc.)
3. **Path Restrictions**: No path traversal (..) or absolute paths allowed
4. **Execution Timeout**: 30-second timeout per command
5. **Single Execution Lock**: Only one command can run at a time per server
6. **Non-root Container**: Docker container runs as non-root user

⚠️ **Production Hardening TODO**:
- Implement proper chroot jail or container-based isolation
- Add rate limiting and authentication
- Use proper secrets management
- Implement resource limits (CPU, memory)
- Add audit logging
- Consider using specialized sandboxing tools (firejail, bubblewrap)

## CI/CD with GitHub Actions

Three workflows are included:

1. **ci.yml**: Runs on PR and push
   - Installs dependencies
   - Runs linting and tests
   - Builds frontend and backend

2. **docker-build-publish.yml**: Builds and pushes Docker image to GHCR
   - Configure `GITHUB_TOKEN` (automatic)
   - Image: `ghcr.io/mymindventures/smart-cli:latest`

3. **railway-deploy.yml**: Automatic deployment to Railway
   - Configure `RAILWAY_API_KEY` secret in GitHub
   - Deploys on push to main

## TODO: OpenAI Integration

To integrate real AI command generation:

1. **Get OpenAI API Key**: https://platform.openai.com/api-keys

2. **Set environment variable**:
   ```bash
   OPENAI_API_KEY=sk-...
   ```

3. **Update `/backend/server.js`**:
   - Install `openai` package: `npm install openai`
   - Replace stub in `/api/generate` with OpenAI API call
   - Use appropriate system prompt for command generation

Example OpenAI integration:
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    {
      role: "system",
      content: "You are a shell command expert. Generate safe, executable commands based on user prompts. Return only the command, no explanation."
    },
    {
      role: "user",
      content: prompt
    }
  ]
});

const command = completion.choices[0].message.content.trim();
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**⚠️ Security Disclaimer**: This is an MVP implementation. Do not expose this service publicly without proper security hardening, authentication, and resource limits. Command execution can be dangerous if not properly isolated.
