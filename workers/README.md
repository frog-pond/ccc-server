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
- `GET /news/mess`: The Olaf Messenger's posts (`www.olafmessenger.com`'s
  WordPress) as feed items, read and shaped like St. Olaf news. The paper's
  Cloudflare bot challenge currently answers the Worker with a 403, so this is
  a 502 until the paper lets the Worker through.
- `GET /news/mess/wp/v2/:resource` and `/news/mess/wp/v2/:resource/:id`: the
  Messenger's WordPress REST API in WordPress's own shape, for the requests
  the app makes and nothing else (`rulesFor` in
  `source/ccci-stolaf-college/v1/mess-shape.ts`, shared with the Node server:
  anything else is a 404 or 400 without asking the paper). The paper's status,
  content type and `x-wp-total`/`x-wp-totalpages` headers are passed on, with
  an RFC 8288 `Link` header on the lists the app pages through. Every spelling
  of one request shares one stored copy. A 4xx from the paper is passed on
  without a `Cache-Control`; a 5xx, a bot challenge, a redirect or a body that
  is not JSON is an error, a 502 if nothing was ever stored. Behind the same
  bot challenge as `/news/mess`.
- `GET /news/carleton-now` and `GET /news/carletonian`: Carleton
  News (the `carleton.edu/news` WordPress) and The Carletonian (its RSS feed), as
  feed items, shaped by `feedItemsFrom` and `feedItemsFromRss`
  (`source/feeds/`), shared with the Node server. Same behavior as the St. Olaf
  route: a 502 if nothing was ever stored. One difference from Node: a Carletonian response that is not RSS
  (a bot-challenge page, say) is an error, not an empty feed.
- `GET /news/krlx`: KRLX's posts (`content.krlx.org`'s RSS feed) as feed
  items, read and shaped like The Carletonian, with the same 502 when nothing
  was ever stored.
- `GET /news/oleville`, `/news/politicole`, `/news/ksto`, `/news/covid` and
  `/news/nnb`: feeds that are no longer published. Each answers with one feed
  item saying so, dated at the start of the hour (so its ETag holds for the
  hour), the same notice the Node routes send (`deprecatedWpJson` and `retiredNnb` in
  `source/feeds/deprecated.ts`, shared with the Node server). Nothing is
  fetched.
- `GET /calendar/:name`: a calendar as events, in the contract the Node server's
  `/v1/calendar/named/:name` routes keep. The names are `carleton`, `upcoming-convos`
  and `sumo-schedule` (Carleton's calendars, with the pictures their pages show),
  `northfield` (an iCal feed), `krlx-schedule` (a Google calendar), `ksto-schedule` (the weekly schedule
  AAO-React-Native publishes, `ksto-schedule.json`), `stolaf`, and the retired
  `the-cave` and `oleville`. `stolaf` is described below. A retired calendar is a single
  notice event. The others are a 502 if nothing has ever been stored. Shaped by
  `source/calendar/*-shape.ts`, shared with the Node server.
- `GET /calendar/stolaf` is the college calendar, on The Events
  Calendar (Tribe) at `wp.stolaf.edu/calendar`: the next month in campus dates,
  read across the feed's pages (fifty at a time, at most ten pages; a longer feed
  is an error rather than a short calendar). `GET /calendar/student-orgs` (St.
  Olaf) is the events student organizations post to Presence
  (`api.presence.io/stolaf/v1/events`), those on now or still to come, with
  cover images and the organizers' contact (name and email) in `metadata`. Both read events
  the way AAO-React-Native's own parsers do, and an event that cannot be read is
  skipped unless none can.
- `GET /convos/upcoming` (Carleton only): the same list as `upcoming-convos`.
- `GET /student-work/postings` (St. Olaf only): the Oracle Recruiting Student
  Work board, newest first, as `{updatedAt, count, postings}`. Each posting has
  the board's listing (`title`, `postedDate`, `location`), what its title says
  (`displayTitle` without the term prefix or pay code, `term`, `level`,
  `payCode`), what its description says (`unit`, `department`, `wage`, `length`,
  `contact`, `classification`), its Student Work `areas` (slugs, from the
  published `student-work-areas.json`, read by its own `student-work-areas` source that keeps only a list of areas; a unit no area lists goes to the area that
  lists `other`), its apply `url`, and when it was first seen and its detail last
  read. Query parameters narrow the list; values of one parameter (repeated or
  comma-separated) are alternatives, and parameters narrow together: `area`
  (slug), `unit` (five digits, or `none`), `level` (`entry`, `experienced`,
  `lead`, `none`), `term` (`academic-year`, `fall`, `spring`, `summer`, `none`),
  `posted_since` (`YYYY-MM-DD`), `q` (every word starts a word of the title or
  the description, ignoring case and accents), `title` (the same, in the title
  a student sees only), and `sort` (`newest`, the default, or `relevance`, best
  match for `q` or `title` first, a title match counting more). The filters and
  searches run as SQL in the object (FTS5 for the searches), and only the
  postings that match leave it. An unknown parameter or value is a 400. Cacheable for ten minutes; a 502, kept a minute, if Oracle has never been
  read, or if `area` is asked for and the areas file cannot be read.
- `GET /student-work/postings/:id`: one posting, as above, with its
  `description`: `markdown` (what is neither one of the named fields nor on every
  posting), every labelled line as `fields`, and the original `html`. A 404 if it
  is not on the board.
- `GET /student-work/units`: each posting's unit by id, in the contract the
  Node server's `/v1/student-work/units` keeps (`groupUnits` in
  `source/student-work/areas.ts`). A posting whose detail has not been read is
  left out.
- `GET /student-work/postings` (Carleton): the jobs on Carleton's Student
  Employment WordPress site (`/student-employment/post-jobs`), newest first, as
  `{updatedAt, count, postings}`, without the archived ones. Each posting has its
  `title`, page `url`, `postedAt` and `modifiedAt`, its `categories`, whether it
  is available `duringTerm` and `duringBreak`, whether it is `offCampus`
  (community-based work-study), the labelled lines the posting forms use
  (`department`, `dateOpen` and `opensOn` as `YYYY-MM-DD`, `availability`,
  `classification`, `wage`, `supervisor`, `employer`, `workLocation`, `active`),
  and every link in it. Query parameters narrow the list: `when` (`term`,
  `break`), `off_campus` (`true`, `false`), `posted_since` (`YYYY-MM-DD`), and `q`,
  `title` and `sort` as above. Each job also has `firstSeenAt`. The jobs are
  rows in the `StudentWorkDO` named `carleton`, and the filters and searches run
  there as SQL, as for St. Olaf. Cacheable for ten minutes; a 502, kept a minute, if
  the site has never been read. `GET /student-work/postings/:id` adds the
  `description` as above, and is a 404 for a job not listed.
- `GET /bonapp/:cafeId`: what the `bonapp-page` object holds for a café, with
  `state` and `fetchedAt`, a summary, and the whole parsed page with `?full=1`.
  A 502 means BonApp failed with nothing stored. This is a look at the source,
  not the apps' menu contract.

## Sources

- `wp-news` (`src/sources/wp-news.ts`): a WordPress posts feed as feed items,
  fresh for 1 hour and kept a day; only `wp.stolaf.edu`, `www.carleton.edu`
  and `www.olafmessenger.com` load.
- `messenger-api` (`src/sources/messenger.ts`): one request to the Messenger's
  WordPress API, its answer kept as the paper sent it (status, content type,
  body, paging headers), the same lifetimes. Only paths and queries the app
  makes load, and only from `olafmessenger.com`; an answer over 1.9 MB is an
  error, as one SQLite row holds at most 2 MB.
- `rss-news` (`src/sources/rss-news.ts`): an RSS feed as feed items, the same
  lifetimes; only `thecarletonian.com` and `content.krlx.org` load.
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
