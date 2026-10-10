import assert from 'node:assert/strict'
import {beforeEach, test} from 'node:test'
import {createApp, InstitutionSchema} from './app.ts'
import {api as stolafApi, cache as stolafCache} from '../ccci-stolaf-college/index.ts'
import {api as carletonApi, cache as carletonCache} from '../ccci-carleton-college/index.ts'
import {http} from '../ccc-lib/http.ts'

// /_cache needs the admin key.
process.env['ADMIN_KEY'] = 'test-admin-key'
const ADMIN = {authorization: 'Bearer test-admin-key'}

beforeEach(() => {
	stolafCache.clear()
	carletonCache.clear()
})

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
		(
			[
				['stolaf', stolafApi],
				['carleton', carletonApi],
			] as const
		).map(async ([institution, api]) => {
			const prefix = `/${institution}/v1`
			const response = await fetch(`${base}${prefix}/routes`)
			assert.equal(response.status, 200)
			const routes = (await response.json()) as {path: string; displayName: string}[]
			assert.ok(routes.length > 0)
			assert.ok(routes.every((route) => route.path.startsWith(`/${institution}/`)))
			assert.ok(routes.some((route) => route.displayName === 'util/html-to-md'))
			assert.ok(routes.some((route) => route.path === `/${institution}/ping`))
			const middlewarePaths = new Set(
				api.stack
					.filter((layer) => layer.methods.length === 0)
					.map((layer) => `/${institution}${layer.path.toString()}`),
			)
			assert.ok(routes.every((route) => !middlewarePaths.has(route.path)))
			const converted = await fetch(`${base}${prefix}/util/html-to-md`, {
				method: 'QUERY',
				headers: {'content-type': 'application/json'},
				body: JSON.stringify({text: '<b>hi</b>'}),
			})
			assert.equal(converted.status, 200)
			assert.equal(await converted.text(), '**hi**')
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
		['GET', 'HEAD'].map(async (method) => {
			const response = await fetch(`${base}/ping`, {method})
			assert.equal(response.status, 200)
			assert.equal(await response.text(), method === 'GET' ? 'pong' : '')
		}),
	)
	await Promise.all(
		['/', '/_cache'].map(async (path) => {
			assert.equal((await fetch(`${base}${path}`, {headers: ADMIN})).status, 404)
		}),
	)
	assert.equal((await fetch(`${base}/_cache`, {method: 'DELETE', headers: ADMIN})).status, 404)
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
			const cache = (await (
				await fetch(`${base}/${name}/_cache`, {headers: ADMIN})
			).json()) as Record<string, string>
			assert.ok(Object.hasOwn(cache, `/${name}/v1/tools/help`))
			assert.ok(Object.keys(cache).every((key) => key.startsWith(`/${name}/`)))
		}),
	)
	const crossDelete = await fetch(`${base}/stolaf/_cache?key=/carleton/v1/tools/help`, {
		method: 'DELETE',
		headers: ADMIN,
	})
	assert.equal(crossDelete.status, 204)
	assert.equal(crossDelete.headers.get('X-Cache-Deleted'), '0')
	const deleted = await fetch(`${base}/stolaf/_cache`, {method: 'DELETE', headers: ADMIN})
	assert.equal(deleted.status, 204)
	assert.ok(Number(deleted.headers.get('X-Cache-Deleted')) > 0)
	const carleton = await fetch(`${base}/carleton/v1/tools/help`)
	assert.match(carleton.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
	const stolaf = await fetch(`${base}/stolaf/v1/tools/help`)
	assert.equal(stolaf.status, 200)
	assert.equal(upstream.mock.callCount(), 3)
})

void test('deleting one cache key preserves other query variants', async (t) => {
	const upstream = t.mock.method(http, 'get', (url: string) => ({
		json: () => Promise.resolve({source: url}),
	}))
	const base = await serve(t, 'all')
	const removed = '/stolaf/v1/tools/help?edition=one&lang=en'
	const retained = '/stolaf/v1/tools/help?edition=two&lang=en'
	await Promise.all(
		[removed, retained].map(async (path) => {
			assert.equal((await fetch(`${base}${path}`)).status, 200)
		}),
	)
	assert.equal(upstream.mock.callCount(), 2)
	const query = new URLSearchParams({key: removed})
	const deleted = await fetch(`${base}/stolaf/_cache?${query.toString()}`, {
		method: 'DELETE',
		headers: ADMIN,
	})
	assert.equal(deleted.status, 204)
	assert.equal(deleted.headers.get('X-Cache-Deleted'), '1')
	const hit = await fetch(`${base}${retained}`)
	assert.match(hit.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
	assert.equal(upstream.mock.callCount(), 2)
	const miss = await fetch(`${base}${removed}`)
	assert.equal(miss.status, 200)
	assert.doesNotMatch(miss.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
	assert.equal(upstream.mock.callCount(), 3)
})

void test('cache administration needs the admin key', async (t) => {
	t.mock.method(http, 'get', (url: string) => ({
		json: () => Promise.resolve({source: url}),
	}))
	const base = await serve(t, 'all')
	const path = '/stolaf/v1/tools/help'
	assert.equal((await fetch(`${base}${path}`)).status, 200)
	const attempt = (headers: Record<string, string>, method = 'DELETE') =>
		fetch(`${base}/stolaf/_cache`, {method, headers})
	await Promise.all(
		[
			{},
			{authorization: 'Bearer wrong-key'},
			{authorization: 'Basic test-admin-key'},
			{authorization: 'test-admin-key'},
			{'x-admin-key': 'test-admin-key'},
		].flatMap((headers) =>
			['GET', 'HEAD', 'DELETE'].map(async (method) => {
				const refused = await attempt(headers, method)
				assert.equal(refused.status, 404)
				assert.equal(refused.headers.get('X-Cache-Deleted'), null)
			}),
		),
	)
	t.after(() => {
		process.env['ADMIN_KEY'] = 'test-admin-key'
	})
	delete process.env['ADMIN_KEY']
	assert.equal((await attempt(ADMIN)).status, 404)
	assert.equal((await attempt(ADMIN, 'GET')).status, 404)
	process.env['ADMIN_KEY'] = ''
	assert.equal((await attempt({authorization: 'Bearer '})).status, 404)
	process.env['ADMIN_KEY'] = 'test-admin-key'
	const hit = await fetch(`${base}${path}`)
	assert.match(hit.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
	const listing = await attempt(ADMIN, 'GET')
	assert.equal(listing.status, 200)
	assert.ok(Object.hasOwn((await listing.json()) as object, path))
	const deleted = await attempt({authorization: 'bearer test-admin-key'})
	assert.equal(deleted.status, 204)
	assert.equal(deleted.headers.get('X-Cache-Deleted'), '1')
})

void test('a cache listing after a keyed deletion shows only what is left', async (t) => {
	t.mock.method(http, 'get', (url: string) => ({
		json: () => Promise.resolve({source: url}),
	}))
	const base = await serve(t, 'all')
	const removed = '/stolaf/v1/tools/help?edition=one'
	const retained = '/stolaf/v1/tools/help?edition=two'
	const elsewhere = '/carleton/v1/tools/help?edition=one'
	await Promise.all(
		[removed, retained, elsewhere].map(async (path) => {
			assert.equal((await fetch(`${base}${path}`)).status, 200)
		}),
	)
	const list = async (institution: string) => {
		const response = await fetch(`${base}/${institution}/_cache`, {headers: ADMIN})
		assert.equal(response.status, 200)
		assert.equal(response.headers.get('Cache-Status'), null)
		return Object.keys((await response.json()) as Record<string, string>)
	}
	const before = await list('stolaf')
	assert.ok(before.includes(removed))
	assert.ok(before.includes(retained))
	const query = new URLSearchParams({key: removed})
	const deleted = await fetch(`${base}/stolaf/_cache?${query.toString()}`, {
		method: 'DELETE',
		headers: ADMIN,
	})
	assert.equal(deleted.headers.get('X-Cache-Deleted'), '1')
	const after = await list('stolaf')
	assert.ok(!after.includes(removed))
	assert.ok(after.includes(retained))
	assert.ok(after.every((key) => !key.includes('/_cache')))
	assert.ok((await list('carleton')).includes(elsewhere))
})

void test('apps mounting the same institution share its cache', async (t) => {
	const upstream = t.mock.method(http, 'get', (url: string) => ({
		json: () => Promise.resolve({source: url}),
	}))
	const first = await serve(t, 'all')
	const second = await serve(t, 'all')
	const path = '/stolaf/v1/tools/help'
	assert.equal((await fetch(`${first}${path}`)).status, 200)
	const shared = await fetch(`${second}${path}`)
	assert.match(shared.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
	assert.equal(upstream.mock.callCount(), 1)
	const listing = (await (
		await fetch(`${second}/stolaf/_cache`, {headers: ADMIN})
	).json()) as Record<string, string>
	assert.ok(Object.hasOwn(listing, path))
	const deleted = await fetch(`${first}/stolaf/_cache`, {method: 'DELETE', headers: ADMIN})
	assert.equal(deleted.status, 204)
	assert.ok(Number(deleted.headers.get('X-Cache-Deleted')) > 0)
	const refilled = await fetch(`${second}${path}`)
	assert.equal(refilled.status, 200)
	assert.doesNotMatch(refilled.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
	assert.equal(upstream.mock.callCount(), 2)
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
		assert.equal((await fetch(`${base}/_cache`, {headers: ADMIN})).status, 200)
		assert.equal((await fetch(`${base}/_cache`, {method: 'DELETE', headers: ADMIN})).status, 204)
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
	const upstream = t.mock.method(http, 'get', (url: string | URL) => ({
		json: () => {
			if (String(url).endsWith('/AAO-React-Native/breaks.json')) {
				return Promise.resolve({data: {timezone: 'America/Chicago', breaks: {}}})
			}
			if (String(url).endsWith('/AAO-React-Native/building-hours.json')) {
				return Promise.resolve({data: []})
			}
			return Promise.resolve({source: url})
		},
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
					if (name === 'stolaf') assert.deepEqual(await v1.json(), {data: []})
					else assert.match(JSON.stringify(await v1.json()), /building-hours.json/)
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
	assert.equal(upstream.mock.callCount(), 6)
})
/// The sitemap changes with each deploy. Sent without caching headers, a client
/// such as iOS's URL cache judges it fresh on its own and keeps showing an old
/// one; `no-cache` makes it ask again, which the ETag keeps cheap.
void test('route listings tell clients to check with the server before reusing them', async (t) => {
	const base = await serve(t, 'stolaf-college')
	const response = await fetch(`${base}/v1/routes`)
	assert.equal(response.headers.get('cache-control'), 'no-cache')
	assert.ok(response.headers.get('etag'))
})
void test('route listings name each method a path answers, without the implied HEAD', async (t) => {
	await Promise.all(
		(['all', 'stolaf-college', 'carleton-college'] as const).map(async (mode) => {
			const base = await serve(t, mode)
			const prefixes = mode === 'all' ? ['/stolaf', '/carleton'] : ['']
			await Promise.all(
				prefixes.map(async (prefix) => {
					const routes = (await (await fetch(`${base}${prefix}/v1/routes`)).json()) as {
						path: string
						methods: string[]
					}[]
					const methodsAt = (path: string) =>
						routes
							.filter((route) => route.path === `${prefix}${path}`)
							.map((route) => route.methods)
					assert.deepEqual(methodsAt('/_cache'), [['DELETE'], ['GET']])
					assert.deepEqual(methodsAt('/v1/util/html-to-md'), [['QUERY']])
					assert.deepEqual(methodsAt('/ping'), [['GET']])
					assert.ok(routes.every((route) => !route.methods.includes('HEAD')))
				}),
			)
		}),
	)
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
