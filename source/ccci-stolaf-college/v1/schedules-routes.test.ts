import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test, type TestContext} from 'node:test'
import Koa from 'koa'
import {api} from '../index.ts'
import {api as carletonApi} from '../../ccci-carleton-college/index.ts'
import {cachable, type CacheObject} from '../../ccc-koa/cache.ts'
import {ctxCacheControl} from '../../ccc-koa/ctx-cache-control.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {parseScheduleData} from '../../schedules/parse.ts'
import {GH_PAGES} from './gh-pages.ts'

function fixture(name: string): unknown {
	return JSON.parse(
		readFileSync(new URL(`../../schedules/fixtures/${name}.json`, import.meta.url), 'utf8'),
	) as unknown
}

function upstream(t: TestContext) {
	let send = globalThis.fetch.bind(globalThis)
	let requests: string[] = []
	let responses = new Map<string, Response | Error>([
		[GH_PAGES('building-hours-authored.json').href, Response.json({data: fixture('spaces')})],
		[GH_PAGES('breaks.json').href, Response.json({data: fixture('calendar')})],
	])
	t.mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
		let url = input instanceof Request ? input.url : String(input)
		if (!url.startsWith('https://stodevx.github.io/')) return send(input, init)
		requests.push(url)
		let response = responses.get(url)
		if (response instanceof Error) return Promise.reject(response)
		if (!response) return Promise.reject(new Error(`unexpected upstream request ${url}`))
		return Promise.resolve(response.clone())
	})
	return {send, requests, responses}
}

/** Use the server's actual cache middleware, with a controllable store expiry. */
async function serve(t: TestContext) {
	let app = new Koa()
	app.silent = true
	ctxCacheControl(app)
	let now = 0
	let store = new Map<string, {value: CacheObject; expires: number}>()
	app.use(
		cachable({
			setCachedHeader: true,
			get(key, maxAge) {
				assert.equal(maxAge, ONE_HOUR)
				let entry = store.get(key)
				return entry && entry.expires > now ? entry.value : undefined
			},
			set(key, value, maxAge) {
				if (value === undefined) store.delete(key)
				else {
					assert.equal(maxAge, ONE_HOUR)
					store.set(key, {value, expires: now + ONE_HOUR})
				}
			},
		}),
	)
	app.use(api.routes())
	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')
	return {
		base: `http://localhost:${address.port.toFixed(0)}`,
		store,
		expire: () => {
			now += ONE_HOUR
		},
	}
}

void test('/spaces/hours resolves both published inputs against the matched contract', async (t) => {
	let {base} = await serve(t)
	let {send, requests} = upstream(t)
	let response = await send(`${base}/v1/spaces/hours`)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get('cache-control'), 'public, max-age=3600')
	assert.deepEqual(await response.json(), fixture('spaces-resolved'))
	assert.deepEqual(
		requests.toSorted(),
		[GH_PAGES('breaks.json').href, GH_PAGES('building-hours-authored.json').href].toSorted(),
	)
})

void test('/breaks serves only timezone, names and dates from validated definitions', async (t) => {
	let {base} = await serve(t)
	let {send, requests} = upstream(t)
	let response = await send(`${base}/v1/breaks`)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get('cache-control'), 'public, max-age=3600')
	assert.deepEqual(await response.json(), fixture('calendar-response'))
	assert.deepEqual(requests, [GH_PAGES('breaks.json').href])
})

for (let [route, expected, fetches] of [
	['/v1/spaces/hours', 'spaces-resolved', 2],
	['/v1/breaks', 'calendar-response', 1],
] as const) {
	void test(`${route} caches successful responses for one hour and refetches on expiry`, async (t) => {
		let {base, expire} = await serve(t)
		let {send, requests, responses} = upstream(t)
		let first = await send(`${base}${route}`)
		assert.equal(first.status, 200)
		assert.deepEqual(await first.json(), fixture(expected))
		// Changed upstream definitions must not affect a cached response.
		let {calendar} = parseScheduleData(fixture('calendar'), [])
		let fall = calendar.breaks['fall']
		assert.ok(fall)
		fall.name = 'Updated Fall Break'
		responses.set(GH_PAGES('breaks.json').href, Response.json({data: calendar}))
		let cached = await send(`${base}${route}`)
		assert.equal(cached.headers.get('x-cached-response'), 'HIT')
		assert.deepEqual(await cached.json(), fixture(expected))
		assert.equal(requests.length, fetches)
		expire()
		let refreshed = await send(`${base}${route}`)
		assert.equal(refreshed.status, 200)
		assert.equal(refreshed.headers.get('x-cached-response'), null)
		assert.equal(requests.length, fetches * 2)
		let body: unknown = await refreshed.json()
		if (route === '/v1/spaces/hours') assert.deepEqual(body, fixture(expected))
		else {
			assert.equal(
				(body as {data: {breaks: {fall: {name: string}}}}).data.breaks.fall.name,
				fall.name,
			)
		}
	})
}

const badCalendar = {
	data: {timezone: 'America/Chicago', breaks: {fall: {name: 'Fall', date: '2026-02-29'}}},
}
const invalidHours = parseScheduleData(fixture('calendar'), fixture('spaces')).spaces
let firstSpace = invalidHours[0]
assert.ok(firstSpace)
firstSpace.breakSchedule = {fall: 'missing-template'}

for (let [name, file, response, routes] of [
	[
		'unresolved reference',
		'building-hours-authored.json',
		Response.json({data: invalidHours}),
		['/v1/spaces/hours'],
	],
	[
		'malformed hours',
		'building-hours-authored.json',
		Response.json({data: [{}]}),
		['/v1/spaces/hours'],
	],
	[
		'invalid calendar',
		'breaks.json',
		Response.json(badCalendar),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'invalid unused template',
		'breaks.json',
		Response.json({data: {timezone: 'America/Chicago', templates: {empty: []}, breaks: {}}}),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'missing hours envelope',
		'building-hours-authored.json',
		Response.json(fixture('spaces')),
		['/v1/spaces/hours'],
	],
	[
		'missing calendar envelope',
		'breaks.json',
		Response.json(fixture('calendar')),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	['malformed JSON', 'breaks.json', new Response('{'), ['/v1/spaces/hours', '/v1/breaks']],
	[
		'hours fetch failure',
		'building-hours-authored.json',
		new Response('bad request', {status: 400}),
		['/v1/spaces/hours'],
	],
	[
		'calendar fetch failure',
		'breaks.json',
		new Response('bad request', {status: 400}),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'unpublished calendar',
		'breaks.json',
		new Response('not found', {status: 404}),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'calendar network failure',
		'breaks.json',
		new TypeError('network unavailable'),
		['/v1/spaces/hours', '/v1/breaks'],
	],
] as const) {
	for (let route of routes) {
		void test(`${route} fails the whole response for ${name} and does not cache the failure`, async (t) => {
			let {base, store} = await serve(t)
			let {send, responses} = upstream(t)
			let original = responses.get(GH_PAGES(file).href)
			assert.ok(original)
			responses.set(GH_PAGES(file).href, response)
			let failed = await send(`${base}${route}`)
			assert.equal(failed.status, 500)
			assert.equal(store.size, 0)
			assert.equal(await failed.text(), 'Internal Server Error')
			responses.set(GH_PAGES(file).href, original)
			let recovered = await send(`${base}${route}`)
			assert.equal(recovered.status, 200)
			assert.deepEqual(
				await recovered.json(),
				fixture(route === '/v1/breaks' ? 'calendar-response' : 'spaces-resolved'),
			)
		})
	}
}

void test('St. Olaf lists /breaks and Carleton has no break route', async (t) => {
	let {base} = await serve(t)
	let response = await fetch(`${base}/v1/routes`)
	let routes = (await response.json()) as {path: string}[]
	assert.ok(routes.some(({path}) => path === '/v1/breaks'))
	assert.equal(carletonApi.match('/v1/breaks', 'GET').route, false)
	assert.ok(carletonApi.match('/v1/spaces/hours', 'GET').route)
})
