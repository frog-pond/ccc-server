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
			assert.ok(routes.every((route) => route.path.startsWith(`${prefix}/`)))
			assert.ok(routes.some((route) => route.displayName === 'util/html-to-md'))
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
	assert.equal(await (await fetch(`${base}/ping`)).text(), 'pong')
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
	const cache = (await (await fetch(`${base}/_cache`)).json()) as Record<string, number>
	assert.ok(Object.hasOwn(cache, '/stolaf/v1/tools/help'))
	assert.ok(Object.hasOwn(cache, '/carleton/v1/tools/help'))
	assert.equal((await fetch(`${base}/_cache`, {method: 'DELETE'})).status, 204)
})

void test('institution selection accepts all and rejects unknown values', () => {
	assert.ok(InstitutionSchema.safeParse('all').success)
	assert.equal(InstitutionSchema.safeParse('unknown').success, false)
})

for (const institution of ['stolaf-college', 'carleton-college'] as const) {
	void test(`${institution} keeps unprefixed routes after creating an all app`, async (t) => {
		await createApp('all')
		const base = await serve(t, institution)
		const response = await fetch(`${base}/v1/routes`)
		assert.equal(response.status, 200)
		const routes = (await response.json()) as {path: string}[]
		assert.ok(routes.every((route) => route.path.startsWith('/v1/')))
		assert.equal((await fetch(`${base}/stolaf/v1/routes`)).status, 404)
		assert.equal((await fetch(`${base}/carleton/v1/routes`)).status, 404)
	})
}

void test('endpoints can add v2 alongside v1 in single and combined modes', async (t) => {
	const upstream = t.mock.method(http, 'get', (url: string) => ({
		json: () => Promise.resolve({source: url}),
	}))
	for (const [name, api] of [
		['stolaf', stolafApi],
		['carleton', carletonApi],
	] as const) {
		const originalLength = api.stack.length
		t.after(() => api.stack.splice(originalLength))
		api.get('/v2/spaces/hours', (ctx) => {
			ctx.body = {institution: name, version: 2}
		})
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
					const v2 = await fetch(`${base}${prefix}/v2/spaces/hours`)
					assert.equal(v2.status, 200)
					assert.deepEqual(await v2.json(), {institution: name, version: 2})
					const routes = (await (await fetch(`${base}${prefix}/v1/routes`)).json()) as {
						path: string
						displayName: string
					}[]
					assert.ok(routes.some((route) => route.path === `${prefix}/v1/spaces/hours`))
					assert.ok(
						routes.some(
							(route) =>
								route.path === `${prefix}/v2/spaces/hours` && route.displayName === 'spaces/hours',
						),
					)
				}),
			)
		}),
	)
	assert.equal(upstream.mock.callCount(), 4)
})
