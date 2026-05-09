# ccc-server

cautious-computing-context: backend node caching server/proxy

## Getting Started

Prerequisites
- Node.js v24.11.0
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

Run these in separate terminals:

```sh
# TypeScript compilation in watch mode
mise run build:watch

# Server with auto-restart
mise run start:watch
```

Institution-specific servers

```sh
mise run stolaf-college
mise run carleton-college
```

### Local Network Discovery (mDNS)

When developing alongside a React Native client on the same network, you can advertise the server via mDNS/Bonjour so the client can discover it automatically without typing the IP address.

```sh
mise run stolaf-college:mdns
mise run carleton-college:mdns
```

This publishes a `_ccc-server._tcp` service (via `dns-sd` on macOS, `bonjour-service` elsewhere). The service name includes the hostname (e.g. `ccc-server (Gecko)`), and the TXT record contains the institution name and the `/v1/` path prefix. The advertisement is torn down cleanly on `SIGTERM`/`SIGINT`.

You can also set `ADVERTISE_MDNS=1` manually alongside any start command:

```sh
ADVERTISE_MDNS=1 mise run stolaf-college
```

To verify the advertisement is visible on the network:

```sh
dns-sd -B _ccc-server._tcp local
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
