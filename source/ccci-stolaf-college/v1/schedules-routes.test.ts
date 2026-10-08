import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {beforeEach, test, type TestContext} from 'node:test'
import Koa from 'koa'
import * as Sentry from '@sentry/node'
import {noop} from 'lodash-es'
import {api, cache as stolafCache} from '../index.ts'
import {createApp} from '../../ccc-server/app.ts'
import {api as carletonApi, cache as carletonCache} from '../../ccci-carleton-college/index.ts'
import {ctxCacheControl} from '../../ccc-koa/ctx-cache-control.ts'
import {ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {parseScheduleData} from '../../schedules/parse.ts'
import {GH_PAGES} from './gh-pages.ts'

beforeEach(() => {
	stolafCache.clear()
	carletonCache.clear()
})

function fixture(name: string): unknown {
	return JSON.parse(
		readFileSync(new URL(`../../schedules/fixtures/${name}.json`, import.meta.url), 'utf8'),
	) as unknown
}

function upstream(t: TestContext, beforeResponse?: () => Promise<void>) {
	let send = globalThis.fetch.bind(globalThis)
	let requests: string[] = []
	let responses = new Map<string, Response | Error>([
		[GH_PAGES('building-hours.json').href, Response.json({data: fixture('spaces')})],
		[GH_PAGES('breaks.json').href, Response.json({data: fixture('calendar')})],
	])
	t.mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
		let url = input instanceof Request ? input.url : String(input)
		if (new URL(url).origin !== GH_PAGES('breaks.json').origin) return send(input, init)
		requests.push(url)
		let response = responses.get(url)
		if (response instanceof Error) return Promise.reject(response)
		if (!response) return Promise.reject(new Error(`unexpected upstream request ${url}`))
		return beforeResponse
			? beforeResponse().then(() => response.clone())
			: Promise.resolve(response.clone())
	})
	return {send, requests, responses}
}

/** Use the institution's actual router and cache, with controllable time. */
async function serve(t: TestContext, onRequest?: () => void, combined = false) {
	let app = combined ? await createApp('all') : new Koa()
	app.silent = true
	ctxCacheControl(app)
	let now = 0
	t.mock.method(Date, 'now', () => now)
	app.use(async (_ctx, next) => {
		onRequest?.()
		await next()
	})
	if (!combined) app.use(api.routes())
	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')
	return {
		base: `http://localhost:${address.port.toFixed(0)}`,
		store: stolafCache,
		advance: (duration: number) => {
			now += duration
		},
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
		[GH_PAGES('breaks.json').href, GH_PAGES('building-hours.json').href].toSorted(),
	)
})

void test('/breaks serves only timezone, names and dates from the retained calendar', async (t) => {
	let {base} = await serve(t)
	let {send, requests} = upstream(t)
	let response = await send(`${base}/v1/breaks`)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get('cache-control'), 'public, max-age=3600')
	assert.deepEqual(await response.json(), fixture('calendar-response'))
	assert.deepEqual(
		requests.toSorted(),
		[GH_PAGES('breaks.json').href, GH_PAGES('building-hours.json').href].toSorted(),
	)
})

const malformedCalendar = {
	data: {timezone: 'America/Chicago', breaks: {fall: {name: 'Fall', start: '2026-10-10'}}},
}

function updatedInputs() {
	let {calendar, spaces} = parseScheduleData(fixture('calendar'), fixture('spaces'))
	let fall = calendar.breaks['fall']
	assert.ok(fall)
	calendar.breaks['autumn'] = fall
	delete calendar.breaks['fall']
	for (let space of spaces) {
		if (space.breakSchedule) {
			space.breakSchedule = Object.fromEntries(
				Object.entries(space.breakSchedule).map(([key, policy]) => [
					key === 'fall' ? 'autumn' : key,
					policy === 'fall' ? 'autumn' : policy,
				]),
			)
		}
	}
	return {calendar, spaces}
}

void test('both routes share a snapshot and its expiry, including after break keys change', async (t) => {
	let {base, advance, store} = await serve(t)
	let {send, requests, responses} = upstream(t)
	let hours = await send(`${base}/v1/spaces/hours`)
	assert.deepEqual(await hours.json(), fixture('spaces-resolved'))
	let updated = updatedInputs()
	responses.set(GH_PAGES('breaks.json').href, Response.json({data: updated.calendar}))
	responses.set(GH_PAGES('building-hours.json').href, Response.json({data: updated.spaces}))
	advance(ONE_HOUR / 2)
	let calendar = await send(`${base}/v1/breaks`)
	assert.deepEqual(await calendar.json(), fixture('calendar-response'))
	assert.equal(calendar.headers.get('cache-control'), 'public, max-age=1800')
	assert.equal(requests.length, 2)
	advance(ONE_HOUR / 2)
	let refreshedCalendar = await send(`${base}/v1/breaks`)
	assert.equal(refreshedCalendar.status, 200)
	let calendarBody = (await refreshedCalendar.json()) as {data: {breaks: Record<string, unknown>}}
	assert.ok(calendarBody.data.breaks['autumn'])
	assert.equal(calendarBody.data.breaks['fall'], undefined)
	let refreshedHours = await send(`${base}/v1/spaces/hours`)
	assert.equal(refreshedHours.status, 200)
	let hoursBody = (await refreshedHours.json()) as {
		data: {breakSchedule: Record<string, unknown>}[]
	}
	assert.ok(hoursBody.data[0]?.breakSchedule['autumn'])
	assert.equal(hoursBody.data[0].breakSchedule['fall'], undefined)
	assert.equal(requests.length, 4)
	// URL-specific response caches must not give either route an independent expiry.
	assert.equal(store.size, 0)
})

for (let changed of ['hours', 'calendar'] as const) {
	void test(`changing only ${changed} refreshes the pair when the other endpoint is requested`, async (t) => {
		let {base, expire} = await serve(t)
		let {send, requests, responses} = upstream(t)
		assert.equal((await send(`${base}/v1/spaces/hours`)).status, 200)
		let {calendar, spaces} = parseScheduleData(fixture('calendar'), fixture('spaces'))
		if (changed === 'hours') {
			let space = spaces[0]
			assert.ok(space?.breakSchedule)
			space.breakSchedule['fall'] = {
				schedule: [{title: 'Updated fall hours', isPhysicallyOpen: false, hours: []}],
				exceptions: [],
			}
			responses.set(GH_PAGES('building-hours.json').href, Response.json({data: spaces}))
		} else {
			let fall = calendar.breaks['fall']
			assert.ok(fall)
			calendar.breaks['fall'] = {...fall, name: 'Updated fall calendar'}
			responses.set(GH_PAGES('breaks.json').href, Response.json({data: calendar}))
		}
		expire()
		let trigger = changed === 'hours' ? '/v1/breaks' : '/v1/spaces/hours'
		assert.equal((await send(`${base}${trigger}`)).status, 200)
		assert.equal(requests.length, 4)
		let changedResponse = await send(
			`${base}${changed === 'hours' ? '/v1/spaces/hours' : '/v1/breaks'}`,
		)
		assert.equal(changedResponse.headers.get('x-cached-response'), 'HIT')
		if (changed === 'hours') {
			let body = (await changedResponse.json()) as {
				data: {breakSchedule: {fall: {schedule: {title: string}[]}}}[]
			}
			assert.equal(body.data[0]?.breakSchedule.fall.schedule[0]?.title, 'Updated fall hours')
		} else {
			let body = (await changedResponse.json()) as {data: {breaks: {fall: {name: string}}}}
			assert.equal(body.data.breaks.fall.name, 'Updated fall calendar')
		}
		assert.equal(requests.length, 4)
	})
}

for (let [name, file, failed] of [
	['malformed calendar', 'breaks.json', Response.json(malformedCalendar)],
	['invalid hours', 'building-hours.json', Response.json({data: [{}]})],
	[
		'incompatible calendar revision',
		'breaks.json',
		Response.json({data: updatedInputs().calendar}),
	],
	['upstream outage', 'breaks.json', new Response('unavailable', {status: 400})],
] as const) {
	void test(`both routes retain the last-good pair after ${name}, throttle retries and recover`, async (t) => {
		t.mock.method(console, 'warn', noop)
		let {base, expire, advance, store} = await serve(t)
		let {send, requests, responses} = upstream(t)
		assert.equal((await send(`${base}/v1/spaces/hours`)).status, 200)
		let original = responses.get(GH_PAGES(file).href)
		assert.ok(original)
		responses.set(GH_PAGES(file).href, failed)
		expire()
		await Promise.all(
			[
				['/v1/breaks', 'calendar-response'],
				['/v1/spaces/hours', 'spaces-resolved'],
			].map(async ([route, expected]) => {
				assert.ok(route)
				assert.ok(expected)
				let stale = await send(`${base}${route}`)
				assert.equal(stale.status, 200)
				assert.deepEqual(await stale.json(), fixture(expected))
				assert.equal(stale.headers.get('x-cached-response'), 'STALE')
				assert.equal(stale.headers.get('cache-control'), 'private, no-cache, no-store')
			}),
		)
		assert.equal(requests.length, 4)
		assert.equal(store.size, 0)
		responses.set(GH_PAGES(file).href, original)
		advance(ONE_MINUTE - 1)
		assert.equal((await send(`${base}/v1/breaks`)).headers.get('x-cached-response'), 'STALE')
		assert.equal(requests.length, 4)
		advance(1)
		let recovered = await send(`${base}/v1/spaces/hours`)
		assert.deepEqual(await recovered.json(), fixture('spaces-resolved'))
		assert.equal(recovered.headers.get('x-cached-response'), null)
		assert.equal(recovered.headers.get('cache-control'), 'public, max-age=3600')
		assert.equal((await send(`${base}/v1/breaks`)).headers.get('x-cached-response'), 'HIT')
		assert.equal(requests.length, 6)
	})
}

for (let keys of [
	[],
	['/v1/spaces/hours'],
	['/v1/breaks'],
	['/v1/spaces/hours', '/v1/breaks'],
	['/v1/spaces/hours', '/v1/spaces/hours'],
]) {
	void test(`cache administration counts evicted entries for ${keys.join(', ') || 'all entries'}`, async (t) => {
		let metrics: Sentry.Metric[] = []
		let scope = Sentry.getCurrentScope()
		let previousClient = scope.getClient()
		let client = new Sentry.NodeClient({
			dsn: 'https://test@example.com/1',
			integrations: [],
			stackParser: () => [],
			transport: () => ({
				send: () => Promise.resolve({statusCode: 200}),
				flush: () => Promise.resolve(true),
			}),
			beforeSendMetric: (metric) => {
				if (metric.name === 'cache.evicted') metrics.push(metric)
				return null
			},
		})
		scope.setClient(client)
		t.after(async () => {
			scope.setClient(previousClient)
			await client.close()
		})
		let {base} = await serve(t)
		let {send, requests, responses} = upstream(t)
		assert.equal((await send(`${base}/v1/spaces/hours`)).status, 200)
		let listing = await send(`${base}/_cache?before=refresh`)
		let entries = (await listing.json()) as Record<string, string>
		assert.equal(entries['/v1/spaces/hours'], '3600')
		assert.equal(entries['/v1/breaks'], '3600')
		let updated = updatedInputs()
		responses.set(GH_PAGES('breaks.json').href, Response.json({data: updated.calendar}))
		responses.set(GH_PAGES('building-hours.json').href, Response.json({data: updated.spaces}))
		let query = keys.length
			? `?${new URLSearchParams(keys.map((key) => ['key', key])).toString()}`
			: ''
		let cleared = await send(`${base}/_cache${query}`, {method: 'DELETE'})
		assert.equal(cleared.status, 204)
		// Delete-all also removes the ordinary response-cache entry for the listing above.
		let expectedCount = keys.length ? 2 : 3
		assert.equal(cleared.headers.get('x-cache-deleted'), String(expectedCount))
		let repeated = await send(`${base}/_cache${query}`, {method: 'DELETE'})
		assert.equal(repeated.headers.get('x-cache-deleted'), '0')
		assert.equal(metrics.length, 2)
		assert.partialDeepStrictEqual(metrics, [
			{
				value: expectedCount,
				attributes: {institution: 'stolaf-college', scope: keys.length ? 'keys' : 'all'},
			},
			{
				value: 0,
				attributes: {institution: 'stolaf-college', scope: keys.length ? 'keys' : 'all'},
			},
		])
		let refreshed = await send(`${base}/v1/breaks`)
		let body = (await refreshed.json()) as {data: {breaks: Record<string, unknown>}}
		assert.ok(Object.hasOwn(body.data.breaks, 'autumn'))
		assert.equal(Object.hasOwn(body.data.breaks, 'fall'), false)
		assert.equal(requests.length, 4)
		assert.equal((await send(`${base}/v1/spaces/hours`)).headers.get('x-cached-response'), 'HIT')
		assert.equal(requests.length, 4)
	})
}

void test('cache administration can clear a failed cold snapshot retry window', async (t) => {
	let {base} = await serve(t)
	let {send, requests, responses} = upstream(t)
	responses.set(GH_PAGES('breaks.json').href, Response.json(malformedCalendar))
	assert.equal((await send(`${base}/v1/breaks`)).status, 500)
	responses.set(GH_PAGES('breaks.json').href, Response.json({data: fixture('calendar')}))
	await send(`${base}/_cache`, {method: 'DELETE'})
	assert.equal((await send(`${base}/v1/breaks`)).status, 200)
	assert.equal(requests.length, 4)
})

void test('combined cache administration lists prefixed keys and preserves institution isolation', async (t) => {
	let {base} = await serve(t, undefined, true)
	let {send, requests} = upstream(t)
	assert.equal((await send(`${base}/stolaf/v1/breaks`)).status, 200)
	let listing = await send(`${base}/stolaf/_cache`)
	let entries = (await listing.json()) as Record<string, string>
	assert.equal(entries['/stolaf/v1/breaks'], '3600')
	assert.equal(entries['/stolaf/v1/spaces/hours'], '3600')
	await send(`${base}/carleton/_cache`, {method: 'DELETE'})
	await send(`${base}/stolaf/_cache?key=/unrelated`, {method: 'DELETE'})
	assert.equal((await send(`${base}/stolaf/v1/breaks`)).headers.get('x-cached-response'), 'HIT')
	assert.equal(requests.length, 2)
	await send(`${base}/stolaf/_cache?key=/stolaf/v1/breaks`, {method: 'DELETE'})
	assert.equal((await send(`${base}/stolaf/v1/spaces/hours`)).status, 200)
	assert.equal(requests.length, 4)
})

void test('an evicted in-flight refresh cannot repopulate the snapshot cache', async (t) => {
	let {base} = await serve(t)
	let gate = Promise.withResolvers<undefined>()
	let started = Promise.withResolvers<undefined>()
	let {send, requests} = upstream(t, () => {
		if (requests.length === 2) started.resolve(undefined)
		return gate.promise
	})
	let pending = send(`${base}/v1/breaks`)
	await started.promise
	await send(`${base}/_cache`, {method: 'DELETE'})
	gate.resolve(undefined)
	assert.equal((await pending).status, 200)
	assert.equal((await send(`${base}/v1/spaces/hours`)).status, 200)
	assert.equal(requests.length, 4)
})

void test('concurrent requests to both routes share one in-flight upstream pair', async (t) => {
	let entered = Promise.withResolvers<undefined>()
	let count = 0
	let {base} = await serve(t, () => {
		count += 1
		if (count === 2) entered.resolve(undefined)
	})
	let gate = Promise.withResolvers<undefined>()
	let started = Promise.withResolvers<undefined>()
	let {send, requests} = upstream(t, () => {
		if (requests.length === 2) started.resolve(undefined)
		return gate.promise
	})
	let pending = [send(`${base}/v1/breaks`), send(`${base}/v1/spaces/hours`)]
	await Promise.all([started.promise, entered.promise])
	gate.resolve(undefined)
	let [calendar, hours] = await Promise.all(pending)
	assert.ok(calendar)
	assert.ok(hours)
	assert.equal(calendar.status, 200)
	assert.equal(hours.status, 200)
	assert.deepEqual(await calendar.json(), fixture('calendar-response'))
	assert.deepEqual(await hours.json(), fixture('spaces-resolved'))
	assert.equal(requests.length, 2)
})
const invalidHours = parseScheduleData(fixture('calendar'), fixture('spaces')).spaces
let firstSpace = invalidHours[0]
assert.ok(firstSpace)
firstSpace.breakSchedule = {fall: 'missing-template'}

for (let [name, file, response, routes] of [
	[
		'unresolved reference',
		'building-hours.json',
		Response.json({data: invalidHours}),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'malformed hours',
		'building-hours.json',
		Response.json({data: [{}]}),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'malformed calendar',
		'breaks.json',
		Response.json(malformedCalendar),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'malformed unused template container',
		'breaks.json',
		Response.json({
			data: {timezone: 'America/Chicago', templates: {malformed: {schedule: {}}}, breaks: {}},
		}),
		['/v1/spaces/hours', '/v1/breaks'],
	],
	[
		'missing hours envelope',
		'building-hours.json',
		Response.json(fixture('spaces')),
		['/v1/spaces/hours', '/v1/breaks'],
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
		'building-hours.json',
		new Response('bad request', {status: 400}),
		['/v1/spaces/hours', '/v1/breaks'],
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
		void test(`${route} throttles ${name} without caching an error response`, async (t) => {
			let {base, store, advance} = await serve(t)
			let {send, responses, requests} = upstream(t)
			let original = responses.get(GH_PAGES(file).href)
			assert.ok(original)
			responses.set(GH_PAGES(file).href, response)
			let failed = await send(`${base}${route}`)
			assert.equal(failed.status, 500)
			assert.equal(store.size, 0)
			assert.equal(await failed.text(), 'Internal Server Error')
			responses.set(GH_PAGES(file).href, original)
			advance(ONE_MINUTE - 1)
			let otherRoute = route === '/v1/breaks' ? '/v1/spaces/hours' : '/v1/breaks'
			assert.equal((await send(`${base}${otherRoute}`)).status, 500)
			assert.equal(requests.length, 2)
			advance(1)
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
