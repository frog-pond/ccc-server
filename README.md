# ccc-server

cautious-computing-context: backend node caching server/proxy

## Getting Started

Prerequisites
- Node.js v20.17
- npm

Install

```sh
git clone https://github.com/frog-pond/ccc-server.git
cd ccc-server
npm ci
```

## Running the Server

### Development

Watch mode (recommended): auto-recompile & restart on changes

```sh
mise run watch
```

Institution-specific servers

```sh
mise run stolaf-college
mise run carleton-college
```

### Production

```sh
mise run build
mise run start:prod
```

## Testing

All tests

```sh
mise run test
```

Smoke tests

```sh
mise run test:stolaf-college
mise run test:carleton-college
```

TDD workflow

This repository practices TDD for agentic development: write a failing AVA test next to the implementation (`*.test.ts`), run `mise run test`, implement until green, then run smoke tests for integration checks.

## Deployment

### Automated Release Workflow

The repository uses GitHub Actions to automate server restarts after new releases are published.

#### Prerequisites

The following secrets must be configured in GitHub:

- **`RESTART_TOKEN`** - Secret token for authenticating restart requests (must match the server's `RESTART_TOKEN` environment variable)
- **`SERVER_URL`** - Base URL of the production server (e.g., `https://api.example.com`)
- **`TELEGRAM_TOKEN`** - Bot token for Telegram notifications
- **`TELEGRAM_CHAT_ID`** - Chat ID for Telegram notifications

#### Environment Protection

The workflow uses the `release` environment with manual approval requirements:

1. Go to **Settings > Environments > release**
2. Enable **Required reviewers**
3. Add authorized users who can approve deployments

#### How it Works

1. When a new release is published on GitHub, the workflow:
   - Verifies the release tag matches the version in `package.json`
   - Waits for manual approval (if configured)
   - Triggers a server restart via `POST /restart`
   - Polls the `/health` endpoint to verify the new version is running
   - Sends a Telegram notification on success or failure

2. The server must have:
   - `RESTART_TOKEN` environment variable set (matching GitHub secret)
   - A process manager (systemd, PM2, Docker) that automatically restarts the process on exit

#### Releasing a New Version

Before creating a release:

1. Update the version in `package.json`:
   ```bash
   npm version patch  # or minor, or major
   ```

2. Commit the version change:
   ```bash
   git add package.json package-lock.json
   git commit -m "Bump version to X.Y.Z"
   git push
   ```

3. Create a GitHub release with a tag matching the package.json version (e.g., `v1.2.3`)

The workflow will verify that the release tag matches the package.json version before proceeding with the deployment.

#### Health Check Endpoint

`GET /health`

Returns the current version from `package.json` and status.

Returns:
```json
{
  "version": "1.2.3",
  "status": "ok"
}
```

#### Restart Endpoint

`POST /restart`

Headers:
```
Authorization: Bearer <RESTART_TOKEN>
```

Returns:
```json
{
  "message": "Server restart initiated"
}
```

**Restart Behavior:**

The restart endpoint supports two modes:

1. **Custom Script (Docker/docker-compose deployments)**: Set `RESTART_SCRIPT` environment variable to point to a script that handles the restart. For docker-compose deployments, this script should pull new images and restart containers:

   ```bash
   # Example: /home/user/poke-docker.sh
   #!/bin/sh
   cd /home/user/ccc-server
   docker-compose pull && docker-compose down && docker-compose up -d
   ```

   Set `RESTART_SCRIPT=/home/user/poke-docker.sh` in your environment.

2. **Process Exit (Default)**: If no `RESTART_SCRIPT` is configured, the server will exit gracefully. The process manager (systemd, PM2, or Docker's restart policy) should restart it automatically. **Note**: This won't pull new Docker images, so it's only suitable for non-containerized deployments.
