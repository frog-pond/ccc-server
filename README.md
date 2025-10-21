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
   - Extracts the version from the release tag (e.g., `v1.2.3` → `1.2.3`)
   - Waits for manual approval (if configured)
   - Triggers a server restart via `POST /restart`
   - Polls the `/health` endpoint to verify the new version is running
   - Sends a Telegram notification on success or failure

2. The server must have:
   - `RESTART_TOKEN` environment variable set (matching GitHub secret)
   - A process manager (systemd, PM2, Docker) that automatically restarts the process on exit

#### Health Check Endpoint

`GET /health`

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

The server will exit gracefully, and the process manager should restart it automatically.
