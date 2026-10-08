import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createApp, InstitutionSchema} from './app.ts'
import {api as stolafApi} from '../ccci-stolaf-college/index.ts'
import {api as carletonApi} from '../ccci-carleton-college/index.ts'
import {http} from '../ccc-lib/http.ts'

async function serve(
	t: test.TestContext,
	institution: 'all' | 'stolaf-college' | 'carleton-college',
) {
	const app = await createApp(institution)
	const server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	const address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')
	return `http://localhost:${String(address.port)}`
}

void test('all mounts both institutions with usable route listings and isolated routes', async (t) => {
	const base = await serve(t, 'all')
	await Promise.all(
		['stolaf', 'carleton'].map(async (institution) => {
			const prefix = `/${institution}/v1`
			const response = await fetch(`${base}${prefix}/routes`)
			assert.equal(response.status, 200)
			const routes = (await response.json()) as {path: string; displayName: string}[]
			assert.ok(routes.length > 0)
			assert.ok(routes.every((route) => route.path.startsWith(`/${institution}/`)))
			assert.ok(routes.some((route) => route.displayName === 'util/html-to-md'))
			assert.ok(routes.some((route) => route.path === `/${institution}/ping`))
			const post = await fetch(`${base}${prefix}/util/html-to-md`, {
				method: 'POST',
				headers: {'content-type': 'application/json'},
				body: JSON.stringify({text: '<b>hi</b>'}),
			})
			assert.equal(post.status, 200)
			assert.equal(await post.text(), '**hi**')
			const head = await fetch(`${base}${prefix}/routes`, {method: 'HEAD'})
			assert.equal(head.status, 200)
			const invalidMethod = await fetch(`${base}${prefix}/routes`, {method: 'POST'})
			assert.equal(invalidMethod.status, 405)
		}),
	)
	await Promise.all(
		['/v1/routes', '/unknown/v1/routes', '/carleton/v1/a-to-z/extras'].map(async (path) => {
			assert.equal((await fetch(`${base}${path}`)).status, 404)
		}),
	)
	await Promise.all(
		['/stolaf', '/carleton'].map(async (prefix) => {
			assert.equal(await (await fetch(`${base}${prefix}/`)).text(), 'Hello world!')
			await Promise.all(
				['GET', 'HEAD'].map(async (method) => {
					const response = await fetch(`${base}${prefix}/ping`, {method})
					assert.equal(response.status, 200)
					assert.equal(await response.text(), method === 'GET' ? 'pong' : '')
				}),
			)
		}),
	)
	await Promise.all(
		['/', '/ping', '/_cache'].map(async (path) => {
			assert.equal((await fetch(`${base}${path}`)).status, 404)
		}),
	)
	assert.equal((await fetch(`${base}/_cache`, {method: 'DELETE'})).status, 404)
})

void test('all keeps cached responses separate for the same endpoint at each institution', async (t) => {
	const upstream = t.mock.method(http, 'get', (url: string) => ({
		json: () => Promise.resolve({source: url}),
	}))
	const base = await serve(t, 'all')
	const bodies: unknown[] = []
	await Promise.all(
		['stolaf', 'carleton'].map(async (institution) => {
			const path = `/${institution}/v1/tools/help`
			const first = await fetch(`${base}${path}`)
			assert.equal(first.status, 200)
			const body: unknown = await first.json()
			bodies.push(body)
			const second = await fetch(`${base}${path}`)
			assert.match(second.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
			assert.deepEqual(await second.json(), body)
		}),
	)
	assert.notDeepEqual(bodies[0], bodies[1])
	assert.equal(upstream.mock.callCount(), 2)
	await Promise.all(
		['stolaf', 'carleton'].map(async (name) => {
			const cache = (await (await fetch(`${base}/${name}/_cache`)).json()) as Record<string, number>
			assert.ok(Object.hasOwn(cache, `/${name}/v1/tools/help`))
			assert.ok(Object.keys(cache).every((key) => key.startsWith(`/${name}/`)))
		}),
	)
	const crossDelete = await fetch(`${base}/stolaf/_cache?key=/carleton/v1/tools/help`, {
		method: 'DELETE',
	})
	assert.equal(crossDelete.status, 204)
	assert.equal(crossDelete.headers.get('X-Cache-Deleted'), '0')
	const deleted = await fetch(`${base}/stolaf/_cache`, {method: 'DELETE'})
	assert.equal(deleted.status, 204)
	assert.ok(Number(deleted.headers.get('X-Cache-Deleted')) > 0)
	const carleton = await fetch(`${base}/carleton/v1/tools/help`)
	assert.match(carleton.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
	const stolaf = await fetch(`${base}/stolaf/v1/tools/help`)
	assert.equal(stolaf.status, 200)
	assert.equal(upstream.mock.callCount(), 3)
})

void test('institution selection accepts all and rejects unknown values', () => {
	assert.ok(InstitutionSchema.safeParse('all').success)
	assert.equal(InstitutionSchema.safeParse('unknown').success, false)
})

for (const institution of ['stolaf-college', 'carleton-college'] as const) {
	void test(`${institution} keeps unprefixed routes after creating an all app`, async (t) => {
		await createApp('all')
		const base = await serve(t, institution)
		assert.equal(await (await fetch(`${base}/ping`)).text(), 'pong')
		assert.equal(await (await fetch(`${base}/`)).text(), 'Hello world!')
		assert.equal((await fetch(`${base}/_cache`)).status, 200)
		assert.equal((await fetch(`${base}/_cache`, {method: 'DELETE'})).status, 204)
		const response = await fetch(`${base}/v1/routes`)
		assert.equal(response.status, 200)
		const routes = (await response.json()) as {path: string}[]
		assert.ok(routes.every((route) => !/^\/(stolaf|carleton)\//.test(route.path)))
		assert.ok(routes.some((route) => route.path === '/ping'))
		assert.equal((await fetch(`${base}/stolaf/v1/routes`)).status, 404)
		assert.equal((await fetch(`${base}/carleton/v1/routes`)).status, 404)
	})
}

void test('endpoints can add dotted and major versions alongside v1 in single and combined modes', async (t) => {
	const upstream = t.mock.method(http, 'get', (url: string) => ({
		json: () => Promise.resolve({source: url}),
	}))
	for (const [name, api] of [
		['stolaf', stolafApi],
		['carleton', carletonApi],
	] as const) {
		const originalLength = api.stack.length
		t.after(() => api.stack.splice(originalLength))
		for (const version of ['v1.1', 'v2']) {
			api.get(`/${version}/spaces/hours`, (ctx) => {
				ctx.body = {institution: name, version}
			})
		}
	}
	await Promise.all(
		(['all', 'stolaf-college', 'carleton-college'] as const).map(async (mode) => {
			const base = await serve(t, mode)
			const names = mode === 'all' ? ['stolaf', 'carleton'] : [mode.replace('-college', '')]
			await Promise.all(
				names.map(async (name) => {
					const prefix = mode === 'all' ? `/${name}` : ''
					const v1 = await fetch(`${base}${prefix}/v1/spaces/hours`)
					assert.equal(v1.status, 200)
					assert.match(JSON.stringify(await v1.json()), /building-hours.json/)
					await Promise.all(
						['v1.1', 'v2'].map(async (version) => {
							const response = await fetch(`${base}${prefix}/${version}/spaces/hours`)
							assert.equal(response.status, 200)
							assert.deepEqual(await response.json(), {institution: name, version})
						}),
					)
					const routes = (await (await fetch(`${base}${prefix}/v1/routes`)).json()) as {
						path: string
						displayName: string
					}[]
					assert.ok(routes.some((route) => route.path === `${prefix}/v1/spaces/hours`))
					for (const version of ['v1.1', 'v2']) {
						assert.ok(
							routes.some(
								(route) =>
									route.path === `${prefix}/${version}/spaces/hours` &&
									route.displayName === 'spaces/hours',
							),
						)
					}
				}),
			)
		}),
	)
	assert.equal(upstream.mock.callCount(), 4)
})

void test('mixed-case route listings return usable paths in single and combined modes', async (t) => {
	await Promise.all(
		(['all', 'stolaf-college', 'carleton-college'] as const).map(async (mode) => {
			const base = await serve(t, mode)
			const prefixes = mode === 'all' ? ['/stolaf', '/carleton'] : ['']
			await Promise.all(
				prefixes.map(async (prefix) => {
					const expected: unknown = await (await fetch(`${base}${prefix}/v1/routes`)).json()
					await Promise.all(
						['/V1/ROUTES', '/v1/Routes/'].map(async (suffix) => {
							const response = await fetch(`${base}${prefix}${suffix}`)
							assert.equal(response.status, 200)
							const routes = (await response.json()) as {path: string; displayName: string}[]
							assert.deepEqual(routes, expected)
							const listing = routes.find((route) => route.displayName === 'routes')
							assert.ok(listing)
							assert.equal((await fetch(`${base}${listing.path}`)).status, 200)
						}),
					)
					assert.equal((await fetch(`${base}${prefix}/v1/routes/v1/routes`)).status, 404)
				}),
			)
		}),
	)
})
