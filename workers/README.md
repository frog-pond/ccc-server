# ccc-workers

A Cloudflare Workers / Durable Objects take on ccc-server's caching layer. It
sits beside the Node server and shares no runtime code with it yet.

## Idea

Each upstream resource (one café page, one calendar feed) is a `SourceDO`:
one Durable Object that keeps the last good value in SQLite and owns
everything about keeping it fresh.

- **Single-flight**: readers that arrive while a fetch is out share it.
- **Stale-while-revalidate**: a stale value is answered at once and refreshed
  from the object's alarm, which survives eviction.
- **Stale-if-error with backoff**: a failing upstream is backed off
  (30s, doubling, to 1h) and the stored value keeps being served.
- **Epochs**: a value is only fresh within the epoch it was loaded in, such as
  the campus date, so a menu does not outlive midnight.
- **Idle sources go quiet**: nothing is warmed that nobody has read in 2 days.

A source is declared with `defineSource` and registered with `registerSource`;
callers use `fetchSource(env, source, params)`.

## Commands

Needs npm 12 (`npm install --global npm@12`): npm 10's resolver crashes on
Vitest's peer dependencies. npm 12 also blocks dependency install scripts by
default, and none are needed here, so none are approved.

This is an npm workspace of the root package, so install once at the repo root
(`npm ci`) and it can import from `../source/` (the BonApp extractor and schema
resolve `zod` from the root `node_modules`). Import only modules that are pure
or workerd-safe: not `ccc-lib/http.ts`, `@sentry/node` or `moment-timezone`.

```sh
npm ci              # at the repo root
npm test            # vitest, running inside workerd
npm run typecheck   # regenerates worker-configuration.d.ts first
```

## Routes

- `GET /`: the cafés this knows, by BonApp id.
- `GET /v1/food/menu/:cafeId` and `GET /v1/food/cafe/:cafeId`: the apps' menu and
  café info, in the contract the Node server's routes keep (an unknown id is a
  400; BonApp failing with nothing stored is a 200 with a stand-in). They share
  `menuFrom` and `cafeFrom` (`source/menus-bonapp/shape.ts`) with the Node
  server. Successes are cacheable for an hour, or until campus midnight if that comes sooner (they are dated by the campus day); stand-ins for a minute.
- `GET /v1/news/named/stolaf`: St. Olaf news as feed items, from
  `wp.stolaf.edu`'s WordPress (which blocks the Node server's IP but not a
  Worker's; the Node server only has a stub for older builds). Shaped by
  `feedItemsFrom` (`source/feeds/wp-json-shape.ts`), shared with the Node
  server. Fresh for an hour, kept a day if WordPress fails; a 502 if nothing
  has ever been stored. `olafmessenger.com` is not served here: its Cloudflare
  bot challenge blocks Worker egress.
- `GET /bonapp/:cafeId`: what the `bonapp-page` object holds for a café, with
  `state` and `fetchedAt`, a summary, and the whole parsed page with `?full=1`.
  A 502 means BonApp failed with nothing stored. This is a look at the source,
  not the apps' menu contract.

## Sources

- `wp-news` (`src/sources/wp-news.ts`): a WordPress posts feed as feed items,
  fresh for 1 hour and kept a day; only `wp.stolaf.edu` loads.
- `bonapp-page` (`src/sources/bonapp.ts`): one BonApp café page, parsed and
  validated, `null` when the café is closed. Fresh for 1 hour, kept for a day,
  and the epoch is the campus date. Only `*.cafebonappetit.com` urls load.

A source must be imported from `src/worker.ts`, or the object answers "unknown
source".

## Notes

- Whether a Worker's own egress can fetch the café page is unproven until the
  first deploy.

- `@cloudflare/vitest-plugin` is the renamed `@cloudflare/vitest-pool-workers`.
- Storage is not reset between tests, so each test uses its own source key.
- Time is `clock.now()`, not `Date.now()`; tests move it by assigning to it.
- Reads return a value (`state: 'error'`) rather than throwing across RPC,
  because workerd reports every RPC exception as unhandled, caught or not.

## Cloudflare builds

Workers Builds runs from the repo root (`npm clean-install`, `npm run build`,
then `npx wrangler preview`), and wrangler stops at a workspace root that has no
config of its own. So the one wrangler config lives at the repo root
(`wrangler.jsonc`, with `main` pointing into `workers/`). A Preview does not
inherit its bindings, so `previews` repeats the `SOURCE` binding; a test checks
the two match. This package's scripts and `vitest.config.ts` point at it with
`-c ../wrangler.jsonc`. The root `npm run build` is the Node server's `tsc`; this package's own is
`npm run build` here.

Cloudflare installs and builds from `workers/`, where npm installs only this
workspace's dependencies, so a package imported from `source/` has to be declared
in `workers/package.json` too. The `workers-standalone-build` CI job installs and
builds that way, because the `workers` job installs from the root and cannot see
a missing one.
