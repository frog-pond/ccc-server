import assert from 'node:assert/strict'
import {test} from 'node:test'
import Koa from 'koa'
import {noop} from 'lodash-es'
import {withBodyParsers} from '@koa/body-parsers'
import {api} from './index.ts'

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

/// The v1 routes behind a bare app, with the server's caching stubbed out.
async function serve(t: test.TestContext) {
	let app = new Koa()
	app.context['cacheControl'] = noop
	app.context['cached'] = () => false
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

/// Calls `/streams/search`, with stolaf.edu's collection API faked; returns the
/// response and the query strings the server sent it.
async function searchStreams(t: test.TestContext, search: string) {
	let base = await serve(t)
	let real = globalThis.fetch.bind(globalThis)
	let asked: URLSearchParams[] = []
	t.mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
		let url = input instanceof Request ? input.url : String(input)
		if (!url.startsWith('https://www.stolaf.edu/multimedia/api/collection')) {
			return real(input, init)
		}
		asked.push(new URL(url).searchParams)
		return Promise.resolve(Response.json({results: []}))
	})
	let response = await real(`${base}/v1/streams/search${search}`)
	return {response, asked}
}

/// The year of an upstream `YYYY-MM-DD` date param.
function yearOf(params: URLSearchParams | undefined, name: string) {
	return Number(params?.get(name)?.slice(0, 4))
}

void test('/streams/search passes its query upstream as squery, newest first', async (t) => {
	let {response, asked} = await searchStreams(t, '?query=choir')
	assert.equal(response.status, 200)
	assert.equal(asked.length, 1)
	let params = asked.at(0)
	assert.ok(params)
	assert.equal(params.get('squery'), 'choir')
	assert.equal(params.get('class'), 'archived')
	assert.equal(params.get('sort'), 'descending')
	assert.equal(yearOf(params, 'date_to') - yearOf(params, 'date_from'), 30)
})

void test('/streams/search ignores a date range from the client', async (t) => {
	let {asked} = await searchStreams(t, '?query=choir&dateFrom=1900-01-01&sort=ascending')
	let params = asked.at(0)
	assert.notEqual(params?.get('date_from'), '1900-01-01')
	assert.equal(params?.get('sort'), 'ascending')
})

for (const search of ['', '?query=', '?query=%20%20']) {
	void test(`/streams/search${search} is refused without asking upstream`, async (t) => {
		let {response, asked} = await searchStreams(t, search)
		assert.equal(response.status, 400)
		assert.equal(asked.length, 0)
	})
}
