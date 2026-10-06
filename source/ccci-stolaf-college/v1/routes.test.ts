import assert from 'node:assert/strict'
import {test} from 'node:test'
import Koa from 'koa'
import {noop} from 'lodash-es'
import {withBodyParsers} from '@koa/body-parsers'
import {api} from './index.ts'
import {cachable, type CacheObject} from '../../ccc-koa/cache.ts'
import {ctxCacheControl} from '../../ccc-koa/ctx-cache-control.ts'

/// The routes the app is pointed at; each must exist, or the app's
/// request for it 404s.
const ROUTES = [
	'/v1/a-to-z/extras',
	'/v1/orgs/category-styles',
	'/v1/map/categories',
	'/v1/student-work/areas',
	'/v1/student-work/wages',
	'/v1/map/style',
	'/v1/map/style-dark',
	'/v1/courses/catalog.db',
	'/v1/orgs/uri/agape',
]

for (const route of ROUTES) {
	void test(`${route} is registered`, () => {
		assert.ok(api.match(route, 'GET').route)
	})
}

/// The v1 routes behind a bare app. The server's caching is stubbed out, unless
/// `realCache` asks for the real middleware, keyed as the server keys it.
async function serve(
	t: test.TestContext,
	{realCache = false, onLookup}: {realCache?: boolean; onLookup?: () => void} = {},
) {
	let app = new Koa()
	if (realCache) {
		ctxCacheControl(app)
		let store = new Map<string, CacheObject>()
		app.use(
			cachable({
				get: (key) => store.get(key),
				set: (key, value) => (value ? store.set(key, value) : store.delete(key)),
				statusName: 'test-cache',
				...(onLookup && {onLookup}),
			}),
		)
	} else {
		app.context['cacheControl'] = noop
		app.context['cached'] = () => false
	}
	withBodyParsers(app)
	app.use(api.routes())

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))

	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')
	return `http://localhost:${String(address.port)}`
}

void test('/util/html-to-md accepts its HTML by POST', async (t) => {
	let base = await serve(t)
	let response = await fetch(`${base}/v1/util/html-to-md`, {
		method: 'POST',
		headers: {'content-type': 'application/json'},
		body: JSON.stringify({text: '<b>hi</b>'}),
	})
	assert.equal(response.status, 200)
	assert.equal(await response.text(), '**hi**')
})

void test('/orgs/uri/:uri refuses a slug Presence could not have, without asking Presence', async (t) => {
	let base = `${await serve(t)}/v1/orgs/uri`

	// The test's own requests go through the real fetch; any the server makes
	// to Presence would go through the mock.
	let send = globalThis.fetch.bind(globalThis)
	let upstream = t.mock.method(globalThis, 'fetch')
	let slugs = ['Agape', 'a_b', '-agape', '..%2F..%2Fsecret']
	let statuses = await Promise.all(
		slugs.map(async (slug) => (await send(`${base}/${slug}`)).status),
	)

	assert.deepEqual(statuses, [404, 404, 404, 404])
	assert.equal(upstream.mock.callCount(), 0)
})

/// Presence as `/orgs/uri/:uri` reads it: the list, and each org's portal view.
function fakePresence(t: test.TestContext) {
	let org = (uri: string, categories: string[]) => ({
		subdomain: 'stolaf',
		campusName: 'St. Olaf College',
		name: uri,
		uri,
		hasCoverImage: true,
		photoUri: `${uri}.png`,
		photoUriWithVersion: `${uri}.png?v=0`,
		memberCount: 3,
		categories,
		hasUpcomingEvents: true,
		description: 'An org.',
	})
	let list = [org('chess-club', ['Recreational']), org('balloon-animals', ['Demo'])]
	let campus = {apiId: 'campus-id', cdn: 'https://stolaf-cdn.presence.io'}
	let portal = {
		fieldData: [
			{
				items: [
					{label: 'Primary Organization Contact', value: 'Ole Olson'},
					{label: 'Primary Organization Contact Email', value: 'olson1@stolaf.edu'},
				],
			},
		],
	}

	let real = globalThis.fetch.bind(globalThis)
	t.mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
		let url = input instanceof Request ? input.url : String(input)
		if (url.endsWith('/v1/organizations')) return Promise.resolve(Response.json(list))
		if (url.endsWith('/v1/app/campus')) return Promise.resolve(Response.json(campus))
		if (url.includes('/grid/portal-view/')) return Promise.resolve(Response.json(portal))
		return real(input, init)
	})
}

void test('/orgs/uri/:uri serves an org with its portal fields', async (t) => {
	let base = await serve(t)
	fakePresence(t)

	let response = await fetch(`${base}/v1/orgs/uri/chess-club`)
	assert.equal(response.status, 200)
	let org = (await response.json()) as {
		hasUpcomingEvents: boolean
		photoUrl: string
		contacts: {email: string}[]
	}
	assert.equal(org.hasUpcomingEvents, true)
	assert.equal(
		org.photoUrl,
		'https://stolaf-cdn.presence.io/organization-photos/campus-id/chess-club.png?v=0',
	)
	assert.deepEqual(
		org.contacts.map((c) => c.email),
		['olson1@stolaf.edu'],
	)
})

void test('/orgs/uri/:uri hides a Demo org, as /orgs does', async (t) => {
	let base = await serve(t)
	fakePresence(t)

	assert.equal((await fetch(`${base}/v1/orgs/uri/balloon-animals`)).status, 404)
})

void test('/orgs/uri/:uri is a 404 for an org Presence does not list', async (t) => {
	let base = await serve(t)
	fakePresence(t)

	assert.equal((await fetch(`${base}/v1/orgs/uri/no-such-club`)).status, 404)
})

void test('/streams/search is registered', () => {
	assert.ok(api.match('/v1/streams/search', 'GET').route)
})

/// stolaf.edu's collection API, faked: it answers a page of streams titled for
/// the `squery` it was asked, and records the query strings it was sent. `available`
/// is how many streams match in all; `null` is an answer that doesn't say.
function fakeStreams(t: test.TestContext, {available = 1}: {available?: number | null} = {}) {
	let real = globalThis.fetch.bind(globalThis)
	let asked: URLSearchParams[] = []
	t.mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
		let url = input instanceof Request ? input.url : String(input)
		if (!url.startsWith('https://www.stolaf.edu/multimedia/api/collection')) {
			return real(input, init)
		}
		let params = new URL(url).searchParams
		asked.push(params)

		let count = Number(params.get('count') ?? 50)
		let offset = Number(params.get('offset') ?? 0)
		let onPage = available === null ? count : Math.max(0, Math.min(count, available - offset))
		let stream = (n: number) => ({
			starttime: '2020-01-02 03:04',
			location: '',
			eid: `e${String(n)}`,
			performer: '',
			subtitle: '',
			poster: 'https://example.com/poster',
			player: 'https://example.com/player',
			status: 'archived',
			category: 'concerts',
			hptitle: '',
			category_textcolor: '',
			category_color: '',
			thumb: 'https://example.com/thumb',
			title: `result for ${params.get('squery') ?? ''}`,
			iframesrc: 'https://example.com/embed',
		})
		return Promise.resolve(
			Response.json({
				results: Array.from({length: onPage}, (_, n) => stream(offset + n)),
				...(available !== null && {meta: {available}}),
			}),
		)
	})
	return asked
}

/// Calls `/streams/search` once; returns the response and the query strings the
/// server sent upstream.
async function searchStreams(t: test.TestContext, search: string) {
	let base = await serve(t)
	let asked = fakeStreams(t)
	let response = await fetch(`${base}/v1/streams/search${search}`)
	return {response, asked}
}

void test('/streams/search is cached per query, so a new search is never answered with an old one', async (t) => {
	let base = await serve(t, {realCache: true})
	let asked = fakeStreams(t)
	let titleOf = async (query: string) => {
		let response = await fetch(`${base}/v1/streams/search?query=${query}`)
		assert.equal(response.status, 200)
		return ((await response.json()) as {title: string}[]).map((stream) => stream.title)
	}

	assert.deepEqual(await titleOf('choir'), ['result for choir'])
	assert.deepEqual(await titleOf('band'), ['result for band'])
	assert.deepEqual(await titleOf('choir'), ['result for choir'])
	assert.deepEqual(await titleOf('band'), ['result for band'])
	// each distinct search went upstream once; the repeats came from the cache
	assert.deepEqual(
		asked.map((params) => params.get('squery')),
		['choir', 'band'],
	)
})

/// The one request `/streams/search` makes upstream for `search`.
async function upstreamParams(t: test.TestContext, search: string) {
	let {response, asked} = await searchStreams(t, search)
	assert.equal(response.status, 200)
	assert.equal(asked.length, 1)
	let params = asked.at(0)
	assert.ok(params)
	return params
}

/// Whole days from the upstream `YYYY-MM-DD` date param `from` to `to`.
function daysBetween(params: URLSearchParams, from: string, to: string) {
	let day = (name: string) => Date.parse(`${params.get(name) ?? ''}T00:00:00Z`)
	return Math.round((day(to) - day(from)) / 86_400_000)
}

void test('/streams/search by default looks at the last 30 years of archived streams, newest first', async (t) => {
	let params = await upstreamParams(t, '?query=choir')
	assert.equal(params.get('squery'), 'choir')
	assert.equal(params.get('class'), 'archived')
	assert.equal(params.get('sort'), 'descending')
	assert.equal(params.get('count'), '50')
	assert.equal(params.get('offset'), '0')
	assert.equal(params.has('category'), false)
	assert.ok(Math.abs(daysBetween(params, 'date_from', 'date_to') - 30 * 365.25) < 2)
})

void test('/streams/search takes a sort', async (t) => {
	let params = await upstreamParams(t, '?query=choir&sort=ascending')
	assert.equal(params.get('sort'), 'ascending')
})

void test('/streams/search takes a date range', async (t) => {
	let params = await upstreamParams(t, '?query=choir&dateFrom=2020-01-01&dateTo=2021-06-30')
	assert.equal(params.get('date_from'), '2020-01-01')
	assert.equal(params.get('date_to'), '2021-06-30')
})

void test('/streams/search takes one end of a date range, and defaults the other', async (t) => {
	let params = await upstreamParams(t, '?query=choir&dateFrom=2020-01-01')
	assert.equal(params.get('date_from'), '2020-01-01')
	assert.match(params.get('date_to') ?? '', /^\d{4}-\d{2}-\d{2}$/)
})

void test('/streams/search takes a category', async (t) => {
	let params = await upstreamParams(t, '?query=choir&category=concerts')
	assert.equal(params.get('category'), 'concerts')
})

void test('/streams/search takes a count and an offset', async (t) => {
	let params = await upstreamParams(t, '?query=choir&count=25&offset=50')
	assert.equal(params.get('count'), '25')
	assert.equal(params.get('offset'), '50')
})

void test('/streams/search for upcoming streams asks upstream for current ones, from today on', async (t) => {
	let params = await upstreamParams(t, '?query=choir&class=upcoming')
	assert.equal(params.get('class'), 'current')
	assert.ok(daysBetween(params, 'date_from', 'date_to') > 0)
	let today = new Date().toISOString().slice(0, 10)
	assert.ok(Math.abs(Date.parse(params.get('date_from') ?? '') - Date.parse(today)) <= 86_400_000)
})

void test('/streams/search for all streams spans the past and the near future', async (t) => {
	let params = await upstreamParams(t, '?query=choir&class=all')
	assert.equal(params.get('class'), 'all')
	assert.ok(daysBetween(params, 'date_from', 'date_to') > 30 * 365)
})

void test("/streams/search keeps a client's own range over a class's default", async (t) => {
	let params = await upstreamParams(
		t,
		'?query=choir&class=upcoming&dateFrom=2030-01-01&dateTo=2030-02-01',
	)
	assert.equal(params.get('date_from'), '2030-01-01')
	assert.equal(params.get('date_to'), '2030-02-01')
})

void test('/streams/search from a date past the default end looks on from there', async (t) => {
	let params = await upstreamParams(t, '?query=choir&class=upcoming&dateFrom=2999-01-01')
	assert.equal(params.get('date_from'), '2999-01-01')
	assert.equal(params.get('date_to'), '2999-03-01')
})

void test('/streams/search to a date before the default start looks back from there', async (t) => {
	let params = await upstreamParams(t, '?query=choir&dateTo=1900-01-01')
	assert.equal(params.get('date_to'), '1900-01-01')
	assert.equal(params.get('date_from'), '1870-01-01')
})

void test('/streams/search keeps a default end that already suits the date given', async (t) => {
	let from = await upstreamParams(t, '?query=choir&class=upcoming&dateFrom=2020-01-01')
	assert.equal(from.get('date_from'), '2020-01-01')
	assert.ok((from.get('date_to') ?? '') > new Date().toISOString().slice(0, 10))
	let to = await upstreamParams(t, '?query=choir&dateTo=2020-01-01')
	assert.equal(to.get('date_to'), '2020-01-01')
	assert.ok((to.get('date_from') ?? '9') < '1999')
})

void test('/streams/search refuses a bad request before asking the cache', async (t) => {
	let lookups = 0
	let base = await serve(t, {
		realCache: true,
		onLookup: () => {
			lookups += 1
		},
	})
	let asked = fakeStreams(t)
	let response = await fetch(`${base}/v1/streams/search?query=`)
	assert.equal(response.status, 400)
	assert.equal(lookups, 0)
	assert.equal(asked.length, 0)

	// and a good one does ask it
	await fetch(`${base}/v1/streams/search?query=choir`)
	assert.equal(lookups, 1)
})

const REFUSED = [
	'',
	'?query=',
	'?query=%20%20',
	'?query=choir&class=bogus',
	'?query=choir&sort=sideways',
	'?query=choir&category=',
	'?query=choir&dateFrom=yesterday',
	'?query=choir&dateFrom=2021-01-01&dateTo=2020-01-01',
	'?query=choir&count=0',
	'?query=choir&count=201',
	'?query=choir&count=lots',
	'?query=choir&count=1.5',
	'?query=choir&offset=',
	'?query=choir&offset=%20',
	'?query=choir&count=%20',
	'?query=choir&count=1e2',
	'?query=choir&count=0x32',
	'?query=choir&count=50.0',
	'?query=choir&count=%2B50',
	'?query=choir&offset=1e1',
	'?query=choir&offset=-1',
	'?query=choir&offset=soon',
]

for (const search of REFUSED) {
	void test(`/streams/search${search} is refused without asking upstream`, async (t) => {
		let {response, asked} = await searchStreams(t, search)
		assert.equal(response.status, 400)
		assert.equal(asked.length, 0)
	})
}

/// A `Link` header as {rel: URL}, and the query parameters of each URL.
function parseLink(header: string | null) {
	let links: Record<string, URL> = {}
	for (let part of header?.split(', ') ?? []) {
		let match = /^<([^>]+)>; rel="(\w+)"$/.exec(part)
		assert.ok(match, `not a link: ${part}`)
		links[match[2] ?? ''] = new URL(match[1] ?? '', 'http://example.com')
	}
	return links
}

/// Searches with upstream saying `available` match, and returns the page's Link header.
async function linksFor(t: test.TestContext, search: string, available: number | null) {
	let base = await serve(t)
	fakeStreams(t, {available})
	let response = await fetch(`${base}/v1/streams/search${search}`)
	assert.equal(response.status, 200)
	return parseLink(response.headers.get('link'))
}

/// Which pages a set of links point at: {rel: offset}.
function offsets(links: Record<string, URL>) {
	return Object.fromEntries(
		Object.entries(links).map(([rel, url]) => [rel, url.searchParams.get('offset')]),
	)
}

void test('/streams/search links to the next and last pages from the first', async (t) => {
	let links = await linksFor(t, '?query=choir&count=50', 231)
	assert.deepEqual(offsets(links), {next: '50', last: '200'})
})

void test('/streams/search links to every other page from the middle', async (t) => {
	let links = await linksFor(t, '?query=choir&count=50&offset=100', 231)
	assert.deepEqual(offsets(links), {first: '0', prev: '50', next: '150', last: '200'})
})

void test('/streams/search links back, and not on, from the last page', async (t) => {
	let links = await linksFor(t, '?query=choir&count=50&offset=200', 231)
	assert.deepEqual(offsets(links), {first: '0', prev: '150'})
})

void test('/streams/search has no Link header when everything fits on one page', async (t) => {
	let base = await serve(t)
	fakeStreams(t, {available: 12})
	let response = await fetch(`${base}/v1/streams/search?query=choir`)
	assert.equal(response.headers.has('link'), false)
})

void test('/streams/search has no next page when the last one is exactly full', async (t) => {
	let links = await linksFor(t, '?query=choir&count=50&offset=50', 100)
	assert.deepEqual(offsets(links), {first: '0', prev: '0'})
})

void test('/streams/search from past the end links back to the last page, not past it', async (t) => {
	let links = await linksFor(t, '?query=choir&count=50&offset=1000', 231)
	assert.deepEqual(offsets(links), {first: '0', prev: '200'})
})

void test('/streams/search with no matches has no Link header', async (t) => {
	let links = await linksFor(t, '?query=zzzz', 0)
	assert.deepEqual(links, {})
})

void test('/streams/search links keep the request, changing only the page', async (t) => {
	let links = await linksFor(
		t,
		'?query=choir%20mass&category=chapel&class=all&sort=ascending&dateFrom=2020-01-01&count=10&offset=10',
		100,
	)
	for (let url of Object.values(links)) {
		assert.equal(url.pathname, '/v1/streams/search')
		assert.equal(url.searchParams.get('query'), 'choir mass')
		assert.equal(url.searchParams.get('category'), 'chapel')
		assert.equal(url.searchParams.get('class'), 'all')
		assert.equal(url.searchParams.get('sort'), 'ascending')
		assert.equal(url.searchParams.get('dateFrom'), '2020-01-01')
		assert.equal(url.searchParams.get('count'), '10')
	}
	assert.deepEqual(offsets(links), {first: '0', prev: '0', next: '20', last: '90'})
})

void test('/streams/search links carry the count a default page was served with', async (t) => {
	let links = await linksFor(t, '?query=choir', 231)
	assert.equal(links['next']?.searchParams.get('count'), '50')
})

void test('/streams/search has no Link header when upstream gives no total', async (t) => {
	let base = await serve(t)
	fakeStreams(t, {available: null})
	let response = await fetch(`${base}/v1/streams/search?query=choir&count=5`)
	assert.equal(response.status, 200)
	assert.equal(response.headers.has('link'), false)
})

void test('/streams/search pages by count from its own offset, so next reaches last', async (t) => {
	let links = await linksFor(t, '?query=choir&count=50&offset=30', 231)
	assert.deepEqual(offsets(links), {first: '0', prev: '0', next: '80', last: '230'})
	// 30, 80, 130, 180, 230: stepping by `next` lands on `last`
	assert.equal((230 - 30) % 50, 0)
})

void test('/streams/search gives its Link header again when the page is served from the cache', async (t) => {
	let base = await serve(t, {realCache: true})
	let asked = fakeStreams(t, {available: 231})
	let get = async () => {
		let response = await fetch(`${base}/v1/streams/search?query=choir&count=50&offset=50`)
		assert.equal(response.status, 200)
		return offsets(parseLink(response.headers.get('link')))
	}

	let expected = {first: '0', prev: '0', next: '100', last: '200'}
	assert.deepEqual(await get(), expected)
	assert.deepEqual(await get(), expected)
	assert.equal(asked.length, 1)
})
