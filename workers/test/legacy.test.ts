import {exports} from 'cloudflare:workers'
import {beforeEach, describe, expect, test} from 'vitest'
import {clock} from '../src/clock.ts'
import {CAMPUSES} from '../src/campuses.ts'
import {fromLegacyPath, legacy, legacyCampus, legacyMount, toLegacyPath} from '../src/legacy.ts'
import {campusPaths} from '../src/routes.ts'
import stolafNode from '../../source/ccci-stolaf-college/index.ts?raw'
import carletonNode from '../../source/ccci-carleton-college/index.ts?raw'

// a redirect is the answer, not something to follow
const fetchAt = (url: string, init?: RequestInit) =>
	exports.default.fetch(new Request(url, {redirect: 'manual', ...init}))

/// The `/v1` routes a Node institution router registers.
const nodeRoutes = (source: string) =>
	[...source.matchAll(/api\.get\('(\/v1\/[^']+)'/gu)].map(([, path]) => path ?? '')

/// Node routes the Worker does not serve: the arbitrary-address readers, which
/// were not migrated, and the nutrition route, which was dropped.
const NOT_MIGRATED = new Set([
	'/v1/food/item/:itemId',
	'/v1/calendar/google',
	'/v1/calendar/ics',
	'/v1/news/rss',
	'/v1/news/wpjson',
])

describe('the Node hosts', () => {
	test.each([
		['stolaf.api.frogpond.tech', 'edu.stolaf'],
		['xn--0s9h.api.frogpond.tech', 'edu.stolaf'],
		['carleton.api.frogpond.tech', 'edu.carleton'],
		['xn--vo8h.api.frogpond.tech', 'edu.carleton'],
		['worker.test', undefined],
		['ccc-server.frog-pond-d8f.workers.dev', undefined],
	])('%s is %s', (host, campus) => {
		expect(legacyCampus(new URL(`https://${host}/v1/faqs`))).toBe(campus)
	})

	test('the emoji hosts are the ones a browser asks for', () => {
		expect(new URL('https://🦁.api.frogpond.tech').hostname).toBe('xn--0s9h.api.frogpond.tech')
		expect(new URL('https://🐧.api.frogpond.tech').hostname).toBe('xn--vo8h.api.frogpond.tech')
	})
})

describe.each([
	['edu.stolaf', stolafNode],
	['edu.carleton', carletonNode],
])('every Node route of %s', (campus, source) => {
	let table = CAMPUSES.get(campus)
	if (!table) throw new Error(`no ${campus}`)
	let served = new Set(campusPaths(table))

	test.each(nodeRoutes(source).filter((path) => !NOT_MIGRATED.has(path)))(
		'%s is a route of the campus',
		(path) => {
			let route = fromLegacyPath(path)
			expect(route !== undefined && served.has(route)).toBe(true)
			expect(toLegacyPath(route ?? '')).toBe(path)
		},
	)
})

describe('a request to a Node host', () => {
	// the notices are dated by the clock
	beforeEach(() => {
		clock.now = () => Date.parse('2030-01-15T18:00:00Z')
	})

	test.each([
		['https://stolaf.api.frogpond.tech/v1/faqs', '/edu.stolaf/faqs'],
		['https://xn--vo8h.api.frogpond.tech/v1/spaces/hours', '/edu.carleton/spaces/hours'],
		['https://xn--0s9h.api.frogpond.tech/v1/a-to-z', '/edu.stolaf/a-to-z'],
		[
			'https://stolaf.api.frogpond.tech/v1/calendar/named/oleville',
			'/edu.stolaf/calendar/oleville',
		],
		['https://carleton.api.frogpond.tech/v1/news/named/covid', '/edu.carleton/news/covid'],
	])('%s is answered as %s', async (legacyUrl, path) => {
		let [old, current] = await Promise.all([
			fetchAt(legacyUrl),
			fetchAt(`https://worker.test${path}`),
		])
		expect(old.status).toBe(current.status)
		expect(old.headers.get('location')).toBe(current.headers.get('location'))
		expect(await old.text()).toBe(await current.text())
	})

	test('answers the greeting and ping as Node did', async () => {
		expect(await (await fetchAt('https://stolaf.api.frogpond.tech/')).text()).toBe('Hello world!')
		expect(await (await fetchAt('https://xn--vo8h.api.frogpond.tech/ping')).text()).toBe('pong')
	})

	test('lists the routes at their Node addresses', async () => {
		let response = await fetchAt('https://stolaf.api.frogpond.tech/v1/routes')
		let routes = (await response.json()) as {path: string; displayName: string}[]
		expect(
			routes.every(({path}) => path === '/' || path === '/ping' || path.startsWith('/v1/')),
		).toBe(true)
		expect(routes).toContainEqual(
			expect.objectContaining({path: '/v1/news/named/stolaf', displayName: 'news/named/stolaf'}),
		)
		expect(routes).toContainEqual(expect.objectContaining({path: '/v1/calendar/named/northfield'}))
	})

	test('still answers the campus routes', async () => {
		let response = await fetchAt('https://stolaf.api.frogpond.tech/edu.stolaf/faqs')
		expect(response.status).toBe(307)
	})

	test('a route that is not migrated is a 404', async () => {
		expect((await fetchAt('https://stolaf.api.frogpond.tech/v1/news/rss?url=x')).status).toBe(404)
	})

	test('a /v1 path on any other host is a 404', async () => {
		expect((await fetchAt('https://worker.test/v1/faqs')).status).toBe(404)
	})

	test('answers with an ETag, and a 304 when it matches', async () => {
		let first = await fetchAt('https://stolaf.api.frogpond.tech/v1/a-to-z')
		let etag = first.headers.get('etag')
		expect(etag).toBeTruthy()
		let again = await fetchAt('https://stolaf.api.frogpond.tech/v1/a-to-z', {
			headers: {'If-None-Match': etag ?? ''},
		})
		expect(again.status).toBe(304)
	})
})

describe('the Node routes under a campus prefix', () => {
	beforeEach(() => {
		clock.now = () => Date.parse('2030-01-15T18:00:00Z')
	})

	test.each([
		[
			'https://worker.test/edu.stolaf/v1/faqs',
			{campus: 'edu.stolaf', mount: '/edu.stolaf', path: '/v1/faqs'},
		],
		[
			'https://stolaf.api.frogpond.tech/edu.carleton/v1/menu',
			{campus: 'edu.carleton', mount: '/edu.carleton', path: '/v1/menu'},
		],
		[
			'https://stolaf.api.frogpond.tech/v1/faqs',
			{campus: 'edu.stolaf', mount: '', path: '/v1/faqs'},
		],
		['https://worker.test/edu.unknown/v1/faqs', undefined],
		['https://worker.test/edu.stolaf/faqs', undefined],
	])('%s is mounted at %o', (url, mount) => {
		expect(legacyMount(new URL(url))).toEqual(mount)
	})

	test.each([
		['https://worker.test/edu.stolaf/v1/faqs', '/edu.stolaf/faqs'],
		['https://worker.test/edu.carleton/v1/spaces/hours', '/edu.carleton/spaces/hours'],
		['https://stolaf.api.frogpond.tech/edu.stolaf/v1/a-to-z', '/edu.stolaf/a-to-z'],
		['https://worker.test/edu.stolaf/v1/calendar/named/oleville', '/edu.stolaf/calendar/oleville'],
		['https://worker.test/edu.carleton/v1/news/named/covid', '/edu.carleton/news/covid'],
	])('%s is answered as %s', async (legacyUrl, path) => {
		let [old, current] = await Promise.all([
			fetchAt(legacyUrl),
			fetchAt(`https://worker.test${path}`),
		])
		expect(old.status).toBe(current.status)
		expect(old.headers.get('location')).toBe(current.headers.get('location'))
		expect(await old.text()).toBe(await current.text())
	})

	test('lists the routes at their prefixed Node addresses', async () => {
		let response = await fetchAt('https://worker.test/edu.carleton/v1/routes')
		let routes = (await response.json()) as {path: string; displayName: string}[]
		expect(routes.every(({path}) => path.startsWith('/edu.carleton/'))).toBe(true)
		expect(routes).toContainEqual(
			expect.objectContaining({
				path: '/edu.carleton/v1/news/named/carleton-now',
				displayName: 'news/named/carleton-now',
			}),
		)
		expect(routes).toContainEqual(expect.objectContaining({path: '/edu.carleton/ping'}))
	})

	test('points a Link back at the prefixed Node address', async () => {
		let response = await legacy(
			new Request('https://worker.test/edu.stolaf/v1/news/named/stolaf'),
			(inner) => {
				expect(new URL(inner.url).pathname).toBe('/edu.stolaf/news/stolaf')
				return Promise.resolve(
					new Response('[]', {
						headers: {Link: '</edu.stolaf/news/stolaf?before=2030-01-01>; rel="next"'},
					}),
				)
			},
		)
		expect(response?.headers.get('Link')).toBe(
			'</edu.stolaf/v1/news/named/stolaf?before=2030-01-01>; rel="next"',
		)
	})

	test('a route that is not migrated is a 404', async () => {
		expect((await fetchAt('https://worker.test/edu.stolaf/v1/news/rss?url=x')).status).toBe(404)
	})
})
