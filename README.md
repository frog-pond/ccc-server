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

## Cache endpoint

Each institution keeps an in-memory response cache, and `/_cache` lets you see
and clear it. It lives next to `/ping`: at `/_cache` for a single-institution
server, and at `/stolaf/_cache` and `/carleton/_cache` in combined mode. Each one
only sees its own institution's entries.

### Authentication

Set `ADMIN_KEY` in `.env` and send it as a bearer token in the `Authorization`
header: `Authorization: Bearer <ADMIN_KEY>`.

Without `ADMIN_KEY` set, or without a matching token, every `/_cache` request
answers 404 as if the route didn't exist.

### Listing entries

`GET /_cache` returns a JSON object mapping each cache key to the whole seconds
until that entry expires. A key is the request path plus its query string, with
the institution prefix in combined mode:

```sh
curl -H "Authorization: Bearer $ADMIN_KEY" https://stolaf.api.frogpond.tech/_cache
```

```json
{
  "/v1/food/named/menu/stav-hall": "312",
  "/v1/calendar/ics?url=https%3A%2F%2Fexample.com%2Fevents.ics": "3540"
}
```

The listing is never cached itself, so it always shows the current state,
including right after a deletion.

### Deleting entries

`DELETE /_cache` clears the institution's whole cache. Add one or more `key`
parameters, URL-encoded, to remove only those entries; other query variants of
the same path stay. The response is `204 No Content`, with the number of evicted
entries in `X-Cache-Deleted`.

```sh
# everything
curl -X DELETE -H "Authorization: Bearer $ADMIN_KEY" https://stolaf.api.frogpond.tech/_cache

# one entry
curl -X DELETE -H "Authorization: Bearer $ADMIN_KEY" -G \
  --data-urlencode 'key=/v1/food/named/menu/stav-hall' \
  https://stolaf.api.frogpond.tech/_cache
```

The next request for an evicted route fetches from upstream again. St. Olaf's
hours and breaks share one snapshot; see [Schedule snapshots](#schedule-snapshots)
for how deleting either key behaves.

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

St. Olaf's `/v1/spaces/hours` and `/v1/breaks` share one resolved snapshot per
app instance, refreshed after an hour. If a refresh fails, both routes can serve
the last successful snapshot for up to 24 hours, with `X-Cached-Response: STALE`
and `Cache-Control: private, no-cache, no-store`. Refresh failures are retried
after one minute, including when no successful snapshot exists yet.

`/v1/spaces/hours` answers for the current campus day: during a break, each
space with a schedule for it serves that schedule and its exceptions in place of
the usual ones, keeping `breakSchedule` whole, and the response is not kept past
campus midnight. `?breaks=none` leaves every space's usual schedule in place,
kept like `/v1/breaks`, for a client that picks the break itself; any other
`breaks` value is a 400. `/v1/breaks` lists the breaks for clients that look
ahead.

`/_cache` lists this snapshot under both route paths (with `/stolaf` in combined
mode). Deleting either listed key invalidates the whole pair, including any
failure retry window. Either key reports two evicted entries in `X-Cache-Deleted`
and the `cache.evicted` metric, matching the listing; requesting both keys counts
the pair once. Deleting all entries also clears the snapshot. An
in-flight request may finish using its old data, but cannot refill an evicted
snapshot. Query-string variants share the same snapshot and canonical admin keys.

On refresh, the server fetches both inputs and expands their references before
replacing either cached response. AAO validates authoring before publication;
the server checks normalized containers and the references it expands. The upstream
URLs do not expose a shared revision, so these checks cannot prove that both files
belong to the same upstream publication. Separate
client requests straddling a refresh can also observe different snapshots. A
stronger consistency contract requires a shared upstream revision (or one combined
artifact) and a way for clients to request or compare that revision.

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
