# ccc-server

cautious-computing-context: a caching proxy for the college apps, running on Cloudflare Workers

## Getting Started

Prerequisites
- [mise](https://mise.jdx.dev), which installs the Node version in `.config/mise.toml`
- npm

Install

```sh
git clone https://github.com/frog-pond/ccc-server.git
cd ccc-server
npm ci
cp .dev.vars.example .dev.vars
```

Fill in `GOOGLE_CALENDAR_API_KEY` in `.dev.vars` if you need the Google Calendar routes.

## Running Locally

Each school runs as its own Worker. `wrangler dev` serves it at `http://localhost:8787` and reloads on change.

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

These run `scripts/dev-mdns.ts`, which starts `wrangler dev` on port 3000 on all interfaces and publishes a `_ccc-server._tcp` service (via `dns-sd` on macOS, `bonjour-service` elsewhere). The service name includes the hostname (e.g. `ccc-server (Gecko)`), and the TXT record contains the institution name and the `/v1/` path prefix. The advertisement is torn down cleanly on `SIGTERM`/`SIGINT`.

To verify the advertisement is visible on the network:

```sh
dns-sd -B _ccc-server._tcp local
```

## Testing

Unit tests, and replay tests that run each school's real Worker against recorded upstream responses (no network):

```sh
mise run test
```

Refresh the recorded upstream responses in `test/fixtures/` (hits the live sites):

```sh
mise run fixtures:record
```

Live smoke tests against the real upstreams:

```sh
mise run test:live:stolaf-college
mise run test:live:carleton-college
```

TDD workflow

This repository practices TDD for agentic development: write a failing `node:test` test next to the implementation (`*.test.ts`), run `mise run test`, implement until green, then run the live smoke tests for integration checks.

## Deploying

Merges to `master` deploy both Workers through GitHub Actions. Pull requests get preview URLs, posted as a comment.

Secrets are set once per Worker:

```sh
npx wrangler secret put GOOGLE_CALENDAR_API_KEY --env stolaf-college
npx wrangler secret put GOOGLE_CALENDAR_API_KEY --env carleton-college
```
