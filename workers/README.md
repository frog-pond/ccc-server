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

Every route is mounted under a campus, `/edu.stolaf` or `/edu.carleton`, and has
no `/v1` prefix. Each campus has its own table in `src/campuses.ts` (its cafés, news
feeds and calendars), so one can change without the other. The paths below are shown
without the prefix. The Node server's arbitrary-URL endpoints (`/news/rss`,
`/news/wpjson`, `/calendar/ics`, `/calendar/google`) are not migrated: a route
names its source.

- `GET /`: the campuses.

Every successful response carries an `ETag`, a digest of its body, and a
request whose `If-None-Match` names it is answered with a `304` and no body
(`src/etag.ts`). So once a response's `max-age` runs out, a client re-checks
and downloads again only if the body changed.

Successes are cacheable for ten minutes and errors for a minute
(`src/lifetimes.ts`). Behind them, each source is fresh for an hour and kept a
day if its host fails; student work keeps its own schedule, below.

- `GET /food/menu/:cafeId` and `GET /food/cafe/:cafeId`: the apps' menu and
  café info, in the contract the Node server's routes keep (an unknown id is a
  400; BonApp failing with nothing stored is a 200 with a stand-in). They share
  `menuFrom` and `cafeFrom` (`source/menus-bonapp/shape.ts`) with the Node
  server. Successes are cacheable for ten minutes, or until campus midnight if
  that comes sooner (they are dated by the campus day); stand-ins for a minute.
- `GET /news/stolaf`: St. Olaf news as feed items, from
  `wp.stolaf.edu`'s WordPress (which blocks the Node server's IP but not a
  Worker's; the Node server only has a stub for older builds). Shaped by
  `feedItemsFrom` (`source/feeds/wp-json-shape.ts`), shared with the Node
  server. A 502 if nothing has ever been stored.
- `GET /news/mess` and `GET /news/carletonian`: The Olaf Messenger's and The
  Carletonian's posts (`www.olafmessenger.com`'s and `thecarletonian.com`'s
  WordPress) as feed items, read and shaped like St. Olaf news. Both papers'
  Cloudflare bot challenges currently answer the Worker with a 403, so these
  are 502s until the papers let the Worker through. The Carletonian is read
  from its WordPress API, where the Node server reads its RSS feed.
- `GET /news/mess/wp/v2/:resource[/:id]` and
  `GET /news/carletonian/wp/v2/:resource[/:id]`: each paper's WordPress REST
  API in WordPress's own shape, for the requests the app makes and nothing else
  (`rulesFor` in `source/ccci-stolaf-college/v1/mess-shape.ts`, shared with
  the Node server's Messenger route; the papers run the same WordPress
  plugins). Anything else is a 404 or 400 without asking the paper. The
  paper's status, content type and `x-wp-total`/`x-wp-totalpages` headers are
  passed on, with an RFC 8288 `Link` header on the lists the app pages
  through. Every spelling of one request shares one stored copy. A 4xx from
  the paper is passed on without a `Cache-Control`; a 5xx, a bot challenge, a
  redirect or a body that is not JSON is an error, a 502 if nothing was ever
  stored. Behind the same bot challenges as the feeds.
- `GET /news/carleton-now`: Carleton News (the `carleton.edu/news` WordPress)
  as feed items, shaped by `feedItemsFrom`, shared with the Node server. A 502
  if nothing was ever stored.
- `GET /news/krlx`: KRLX's posts (`content.krlx.org`'s RSS feed) as feed
  items, shaped by `feedItemsFromRss` (`source/feeds/rss-shape.ts`), shared
  with the Node server. A 502 if nothing was ever stored. One difference from
  Node: a response that is not RSS (a bot-challenge page, say) is an error,
  not an empty feed.
- `GET /edu.stolaf/news/oleville`, `/edu.stolaf/news/politicole`,
  `/edu.stolaf/news/ksto`, `/edu.carleton/news/covid` and
  `/edu.carleton/news/nnb`: feeds that are no longer published. Each answers
  with one undated feed item saying so (so its body and ETag never change), the
  notice the Node routes send (`deprecatedWpJson` and `retiredNnb` in
  `source/feeds/deprecated.ts`, shared with the Node server, which dates it
  at the request). Nothing is fetched.
- `GET /edu.stolaf/orgs`: every student org Presence lists, in the app's list
  order, as the Node route answers them (`presenceOrgs` and `withoutDemoOrgs` in
  `source/student-orgs/presence-shape.ts`, shared with the Node server; orgs in
  Presence's Demo category are left out). `?q=` keeps the orgs whose name or
  description has words starting with each word given; `?category=` (repeatable)
  keeps the orgs in any of the categories named. Other parameters are ignored,
  as Node ignores them. A 502 if nothing was ever stored.
- `GET /edu.stolaf/orgs/categories`: each category with the uris of its orgs,
  as the Node route answers them (`presenceCategories` and
  `withoutDemoCategory`).
- `GET /edu.stolaf/orgs/uri/:uri`: one org with the contacts, advisors, links
  and office details from its Presence portal view (`orgDetail`, with
  `portalFields` in `source/student-orgs/portal.ts`). A uri that is not a
  Presence slug, or not in the list, is a 404 without reading Presence. A 502
  when the portal view cannot be read and nothing is stored.
- `GET /edu.carleton/orgs`: the orgs on `apps.carleton.edu/student/orgs/`,
  read as the Node scraper reads them (`orgsFromHtml` in
  `source/ccci-carleton-college/v1/orgs-shape.ts`), with the same `?q=` and
  `?category=`. The page currently answers with a bot check; until it can be
  read this is the Node route's notice (`unavailableOrgs`), cacheable for a
  minute, and it becomes the list on its own once a read succeeds.
- `GET /edu.carleton/jobs`: Carleton's Student Employment jobs in the Node
  route's shape (`jobFromPost` in `source/ccci-carleton-college/v1/jobs-shape.ts`,
  shared with the Node server), newest first, read from the Carleton student
  work board below, so it costs no fetch of its own. A 502 if nothing was ever stored.
- `GET /edu.stolaf/jobs`: the Node route's notice that the listings moved
  (`deprecatedJobs` in `source/student-work/retired-jobs.ts`), dated by a fixed
  day so its body and ETag never change. Nothing is fetched.

## Sources

- `wp-news` (`src/sources/wp-news.ts`): a WordPress posts feed as feed items,
  fresh for 1 hour and kept a day; only `wp.stolaf.edu`, `www.carleton.edu`,
  `www.olafmessenger.com` and `thecarletonian.com` load.
- `wordpress-api` (`src/sources/wordpress-api.ts`): one request to a paper's
  WordPress API, its answer kept as the paper sent it (status, content type,
  body, paging headers), the same lifetimes. Only the Messenger's and The
  Carletonian's APIs, and only paths and queries the app makes, load; an answer
  whose stored JSON is over 1.9 MB is an error, as one SQLite row holds at most 2 MB.
- `rss-news` (`src/sources/rss-news.ts`): an RSS feed as feed items, the same
  lifetimes; only `content.krlx.org` loads.
- `calendar-ical`, `calendar-carleton`, `calendar-google`,
  `calendar-weekly-schedule`, `calendar-tec` and `calendar-presence`
  (`src/sources/calendars.ts`): a calendar's events, fresh for an hour and kept a
  day. Only the hosts the routes name load
  (`www.northfieldmn.gov`, `www.carleton.edu`, `www.googleapis.com`,
  `stolaf.dev`, `wp.stolaf.edu`, `api.presence.io`). The Google source reads the Calendar API with the worker's
  `GOOGLE_CALENDAR_API_KEY` secret, which has to be set on the worker (and on its
  Previews); without it those calendars are a 502.
- `bonapp-page` (`src/sources/bonapp.ts`): one BonApp café page, parsed and
  validated, `null` when the café is closed. Fresh for 1 hour, kept for a day,
  and the epoch is the campus date. Only `*.cafebonappetit.com` urls load.

- `StudentWorkDO` (`src/student-work-do.ts`): not a source but its own Durable
  Object (binding `STUDENT_WORK`), holding the St. Olaf Oracle Recruiting board
  as one SQLite row per posting, with the columns the routes filter on and an
  FTS5 index of each posting's title and description. Its alarm reads the board every four hours plus
  up to thirty minutes of random jitter; postings no longer listed are dropped.
  A posting's detail is read when it is new, an hour after a read that found no
  unit, and a day after the last read, at most twenty a run and four at a time; a
  run that leaves some unread comes back two minutes later. A failed board read
  keeps the stored postings and backs off (five minutes, doubling, up to four
  hours), as does Oracle answering 403 or 429. An empty board in place of a full
  one is treated as a failure. Only Oracle's own origin is fetched, and a
  redirect is not followed. It stops refreshing after two days without a read,
  and the next read resumes it. Shaping is in `source/student-work/oracle-shape.ts`
  and `posting-shape.ts`; the unit is read by `unit-number.ts`, shared with the
  Node server.

  The object named `carleton` holds Carleton's board instead (an object keeps
  the board it was first asked for): every page of the Student Employment
  site's WordPress posts (at most ten), without the archived ones, as one row
  per job with its own FTS5 index, on the same schedule, backoff and idling.
  Shaping is in `source/student-work/carleton-shape.ts`; the rows and queries
  in `src/carleton-board.ts`.

- `StudentOrgsDO` (`src/student-orgs-do.ts`): another Durable Object (binding
  `STUDENT_ORGS`), holding a list of student orgs as one SQLite row per org in
  list order, with an FTS5 index of each org's name and description. The object
  named `stolaf` reads Presence (`api.presence.io`: the org list, the campus and
  the category memberships, three requests a run) and also keeps a row per
  category. The object named `carleton` reads Carleton's orgs page; a page with
  no orgs on it (a bot check) is a failure, not an empty list. Its alarm reads
  the list every hour plus up to ten minutes of jitter; orgs no longer listed
  are dropped. A failed read keeps the stored list and backs off (five minutes,
  doubling, up to an hour), an empty list in place of a full one is a failure,
  and it stops refreshing after two days without a read. An org's portal view
  (about 1.5 MB) is read only when someone opens that org; only the fields the
  route answers are kept, in a row per org, and they are read again behind an
  answer once an hour old, or five minutes after a failed read.

  Both objects' schedules (when to read, backoff, idling) are in
  `src/board-schedule.ts`.

Every upstream request goes through `upstream` (`src/upstream.ts`), which sends
`User-Agent: ccc-server/2.0` and never follows a redirect.

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
inherit its bindings or observability settings, so `previews` repeats the
`SOURCE` and `STUDENT_WORK` bindings and the `observability` block; a test
checks they match. This package's scripts and `vitest.config.ts` point at it with
`-c ../wrangler.jsonc`. The root `npm run build` is the Node server's `tsc`; this package's own is
`npm run build` here.

Cloudflare installs and builds from `workers/`, where npm installs only this
workspace's dependencies, so a package imported from `source/` has to be declared
in `workers/package.json` too. The `workers-standalone-build` CI job installs and
builds that way, because the `workers` job installs from the root and cannot see
a missing one.

## Data files, by college

The small JSON files each college publishes on GitHub Pages (faqs, contacts,
help, webcams, hours, dictionary, the campus map) are passed through as they
are, by `pagesJson` (`src/sources/pages-json.ts`), from each campus's `files`
table (`src/campuses.ts`, with the paths and urls in `src/pages-routes.ts`).
A 502 if nothing has ever been stored.
Examples: `/edu.stolaf/faqs`, `/edu.carleton/spaces/hours`.
