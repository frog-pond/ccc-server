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
- `GET /edu.carleton/orgs`: the Node route's notice that Carleton's orgs
  cannot be loaded (`unavailableOrgs` in
  `source/ccci-carleton-college/v1/deprecated.ts`, shared with the Node
  server). Nothing is fetched.
- `GET /edu.carleton/jobs`: Carleton's Student Employment jobs in the Node
  route's shape (`jobFromPost` in `source/ccci-carleton-college/v1/jobs-shape.ts`,
  shared with the Node server), newest first, read from the Carleton student
  work board below, so it costs no fetch of its own. A 502 if nothing was ever stored.
- `GET /edu.stolaf/jobs`: the Node route's notice that the listings moved
  (`deprecatedJobs` in `source/student-work/retired-jobs.ts`), dated by a fixed
  day so its body and ETag never change. Nothing is fetched.

- `GET /edu.stolaf/spaces/hours` and `GET /edu.stolaf/breaks`: the building
  hours with each building's break schedules expanded against the break
  calendar, and the calendar itself, as the Node routes answer them
  (`resolveScheduleResponses` in `source/schedules/resolve.ts`, and
  `publicationData` in `source/schedules/publications.ts`, shared with the
  Node server). Both are read from one pair of the published
  `building-hours.json` and `breaks.json`, so the hours are only resolved
  against the calendar they were read with. A 502 if nothing was ever stored.
- Published files answered with a `307` to where they are published, cacheable
  for ten minutes, with nothing fetched: `/transit/bus`, `/transit/modes` and
  `/food/named/menu/the-pause` on both campuses (each its own college's file),
  and St. Olaf's `/printing/color-printers`, `/reports/stav` and
  `/courses/catalog.db`. The client then reads the file from its host, with
  that host's ETag and caching.
- `GET /images/:group/:name`: a `307` to the app's published image, for the
  groups and names `isPublishedImage` (`source/ccc-lib/images-shape.ts`, shared
  with the Node server) allows. Anything else, or a query string, is a 404.
- `GET /edu.stolaf/a-to-z`: the Node route's notice that the A–Z index cannot be
  loaded here (`deprecatedLinkGroups` in
  `source/ccci-stolaf-college/v1/deprecated-shape.ts`). Nothing is fetched.
- `GET /food/named/menu/:name` and `GET /food/named/cafe/:name`: the menu and
  café info of the café each name stands for (`NAMED_CAFES` in `src/cafes.ts`,
  the Node server's named routes), answered as the id routes answer them, and
  sharing their stored copy.
- `GET /routes`: every route on the campus's table, in the shape of the Node
  server's `/v1/routes` (`path`, `displayName`, `methods`, `params`), sorted by
  path (`src/routes.ts`).
- `GET /athletics/scores`: the college's games, as the Node route makes them
  (`source/athletics/shape.ts`, shared with the Node server): the athletics
  site's scores feed, with livestats' scores for games under way and the
  calendar's results for yesterday's games. Clients keep it for a minute
  while a game is under way or about to start, and otherwise ten minutes (less
  when the next game is about to start sooner). A 502 if nothing was
  ever stored.
- `GET /edu.stolaf/directory/departments` and `/directory/majors`: St.
  Olaf's directory lists, passed through as they are.
- `GET /edu.stolaf/streams/upcoming`, `/streams/archived` and `/streams/search`:
  St. Olaf's streams for the next two months, the last two, or a search, with
  the Node routes' parameters, checked as they check them
  (`source/ccci-stolaf-college/v1/streams-shape.ts`, shared with the Node
  server); parameters that do not check out are a 400 with nothing fetched. A
  search's `Link` header points at its other pages. Every spelling of one query
  shares one stored copy.
- `GET /edu.carleton/convos/upcoming/:id` and `/convos/archived`: a convocation's
  images, description and sponsor from its page on the convocations calendar,
  and the latest hundred convocations in the podcast feed, as the Node routes
  make them (`source/ccci-carleton-college/v1/convos-shape.ts`). An id that is
  not a calendar code (letters and digits, up to 32) is a 404 with nothing
  fetched.

The news feeds, the calendars (all but KSTO's weekly schedule and the
notices), `/streams/archived` and `/convos/archived` also take `?before=`, an
ISO 8601 date or time: the answer is the kept history from before it (ten
news items, fifty events or streams, a hundred convocations), read from
`ArchiveDO` below, with a `Link: <...>; rel="next"` to the page before when
the page is full. News and convocations are latest first; calendars and
streams soonest first within a page, as their live routes are (streams take
`sort=descending`). A `before` that is not a time is a 400. Without
`?before=`, every route answers as it did.

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

- `schedules` (`src/sources/schedules.ts`): St. Olaf's building hours and
  break calendar, read together and resolved; fresh for 1 hour and kept a day.
  Only `stolaf.dev` loads; either file failing, or the pair not resolving, is
  an error.
- `athletics-scores` (`src/sources/athletics.ts`): a college's games from its
  athletics site (three requests a read: scores, livestats and yesterday's
  calendar), fresh for a minute while a game is under way or about to start,
  otherwise until the next game is about to start, at most an hour; kept a
  day. A source can decide its freshness from what it read (`ttlFor`). Only `athletics.stolaf.edu` and
  `athletics.carleton.edu` load.
- `stolaf-directory` (`src/sources/stolaf-directory.ts`): one of St. Olaf's
  two directory lists, fresh for 1 hour and kept a day; only those two
  addresses load.
- `streams` (`src/sources/streams.ts`): one page of St. Olaf's streaming
  collection for one checked query, keyed by the query in a fixed order; fresh
  for 1 hour and kept a day. Its errors never name the query.
- `convo-detail` and `convos-archived` (`src/sources/convos.ts`): a
  convocation's calendar page, and the convocations podcast feed, shaped; fresh
  for 1 hour and kept a day. A page without the event, or a feed that is not
  RSS, is an error.

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
  `STUDENT_ORGS`, one object named `stolaf`), holding St. Olaf's student orgs as
  one SQLite row per org in list order, with an FTS5 index of each org's name
  and description, and a row per category. It reads Presence (`api.presence.io`:
  the org list, the campus and the category memberships, three requests a
  run); only Presence's origin is fetched, and a redirect is not followed. Its alarm reads
  the list every hour plus up to ten minutes of jitter; orgs no longer listed
  are dropped. A failed read keeps the stored list and backs off (five minutes,
  doubling, up to an hour), an empty list in place of a full one is a failure,
  and it stops refreshing after two days without a read. An org's portal view
  (about 1.5 MB) is read only when someone opens that org; only the fields the
  route answers are kept, in a row per org, and they are read again behind an
  answer once an hour old, or five minutes after a failed read.

  Both objects' schedules (when to read, backoff, idling) are in
  `src/board-schedule.ts`.

- `ArchiveDO` (`src/archive-do.ts`, binding `ARCHIVE`): a feed's history,
  one object per feed and one SQLite row per item (a post, an event, a stream,
  a convocation), indexed by when it happens. Whatever a live source reads is
  recorded behind its answer (`record` in `src/define-source.ts`), replacing
  the stored copy. Nothing that has happened is removed; a future item that a
  live read covering its date no longer lists is. The first time a feed is
  recorded, the object's alarm starts walking its history back (two steps a
  run, a minute apart; a failure backs off from a minute, doubling, up to an
  hour) until it reaches the start, and keeps the live copy of anything it
  finds already stored. How each feed is walked is in `src/archives/`: a news
  site's WordPress posts twenty at a time; St. Olaf's whole streams
  collection a hundred at a time; the convocations podcast in one read; an
  iCal feed or Presence in one read of everything they publish; a Tribe
  calendar a month at a time back until a year of empty months; a Google
  calendar its last year. KRLX's history is read from its WordPress API, so
  those items are shaped from WordPress rather than RSS.

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
help, webcams, dictionary, the campus map, Carleton's hours, the student work
areas and wages) are answered with a `307` to where each is published,
cacheable for ten minutes, from each campus's `files` table (`src/campuses.ts`,
with the paths and urls in `src/pages-routes.ts`). Nothing is fetched; the client
reads the file from GitHub Pages, with its ETag and caching. `pagesJson`
(`src/sources/pages-json.ts`) still reads the student work areas file for the
units list.
Examples: `/edu.stolaf/faqs`, `/edu.carleton/spaces/hours`.
