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

```sh
npm ci
npm test            # vitest, running inside workerd
npm run typecheck   # regenerates worker-configuration.d.ts first
```

## Notes

- `@cloudflare/vitest-plugin` is the renamed `@cloudflare/vitest-pool-workers`.
- Storage is not reset between tests, so each test uses its own source key.
- Time is `clock.now()`, not `Date.now()`; tests move it by assigning to it.
- Reads return a value (`state: 'error'`) rather than throwing across RPC,
  because workerd reports every RPC exception as unhandled, caught or not.
