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

### Combined server

Set `INSTITUTION=all` to serve both institutions from one process or container:

```sh
mise run all
# Or for production:
INSTITUTION=all mise run start:prod
```

On `api.frogpond.tech`, the API base URLs would be:

- St. Olaf: `https://api.frogpond.tech/stolaf/v1/`
- Carleton: `https://api.frogpond.tech/carleton/v1/`

Each institution's endpoints and route listing live under its base URL, such as
`/stolaf/v1/routes` and `/carleton/v1/routes`. Server utilities use the same
institution prefixes: `/stolaf/ping`, `/carleton/ping`, `/stolaf/_cache`, and
`/carleton/_cache`. Each cache endpoint lists and deletes only its institution's
entries. The greetings are at `/stolaf/` and `/carleton/`. A root `/ping` endpoint
is also available for server health checks. Each institution exports a fully
configured `api` router with its helpers and response cache. Caches are owned by
the institution modules and shared by apps mounting the same institution in one
process. Each cache holds up to 10,000 entries; keys include the full request URL,
including institution prefixes and query strings.
The existing `INSTITUTION=stolaf-college` and
`INSTITUTION=carleton-college` modes continue to serve `/v1/`.

### Local Network Discovery (mDNS)

When developing alongside a React Native client on the same network, you can advertise the server via mDNS/Bonjour so the client can discover it automatically without typing the IP address.

```sh
mise run stolaf-college:mdns
mise run carleton-college:mdns
```

This publishes a `_ccc-server._tcp` service (via `dns-sd` on macOS, `bonjour-service` elsewhere). The service name includes the hostname (e.g. `ccc-server (Gecko)`), and the TXT record contains the institution name and the `/v1/` path prefix (`institution=all` and `path=/` in combined mode). The advertisement is torn down cleanly on `SIGTERM`/`SIGINT`.

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

## Endpoint versioning

Each institution's `index.ts` registers complete versioned paths on an unprefixed
router. Handlers live in version directories such as `v1/`. To introduce a new
version of one endpoint, add its handler in `v2/` (or `v1.1/` or whatever) and register it alongside v1:

```ts
api.get('/v1/spaces/hours', hoursV1.buildingHours)
api.get('/v2/spaces/hours', hoursV2.buildingHours)
```

Other endpoints can stay on v1. Combined mode adds the institution prefix to both
paths, for example `/stolaf/v2/spaces/hours`. `/v1/routes` lists all registered
endpoint versions for the institution.

## Schedule snapshots

St. Olaf's `/v1/spaces/hours` and `/v1/breaks` share one validated snapshot per
app instance, refreshed after an hour. If a refresh fails, both routes can serve
the last successful snapshot for up to 24 hours, with `X-Cached-Response: STALE`
and `Cache-Control: private, no-cache, no-store`. Refresh failures are retried
after one minute, including when no successful snapshot exists yet.

`/_cache` lists this snapshot under both route paths (with `/stolaf` in combined
mode). Deleting either listed key invalidates the whole pair, including any
failure retry window. Deleting all entries also clears the snapshot. An
in-flight request may finish using its old data, but cannot refill an evicted
snapshot. Query-string variants share the same snapshot and canonical admin keys.

## Images

`GET /v1/images/<group>/<name>.webp` (both servers) proxies `img/<group>/<name>.webp` from the All About Olaf GitHub Pages site, which publishes the `images/` folder of [StoDevX/AAO-React-Native](https://github.com/StoDevX/AAO-React-Native). The groups are `contacts`, `news-sources`, `spaces`, `streaming` and `webcams`; any other group or file name is a 404.

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

## Schedule authoring contracts

AAO owns authoring validation and publishes normalized schedule objects, with
explicit exception lists and references intact. The server checks the published
containers and expands references in one traversal; missing references and cycles
fail expansion. It does not repeat service, date, timezone, or overlap validation.
Service contents and additive metadata pass through unchanged.
Defaults accept only inline policies or template names. Space break policies also
accept `normal`, `inherit`, and aliases to explicitly authored break entries. Local
templates replace global policies completely; aliases use their target's context.
The hours response includes every authored break policy; clients choose the
applicable key using the breaks calendar. The server does not select today's hours.
