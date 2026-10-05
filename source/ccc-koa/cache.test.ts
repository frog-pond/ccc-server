import {test} from 'node:test'
import type {AddressInfo} from 'node:net'
import Koa from 'koa'
import {cachable, type CacheObject} from './cache.ts'

/// A server whose one route caches, and fetches upstream through `fetchUpstream`.
async function serve(t: test.TestContext, fetchUpstream: (path: string) => Promise<unknown>) {
	let store = new Map<string, CacheObject>()
	let app = new Koa()
	app.use(
		cachable({
			get: (key) => store.get(key),
			set: (key, value) => (value ? store.set(key, value) : store.delete(key)),
		}),
	)
	app.use(async (ctx) => {
		if (ctx.path === '/uncached') {
			ctx.body = await fetchUpstream(ctx.path)
			return
		}
		if (ctx.cached(60_000)) return
		ctx.body = await fetchUpstream(ctx.path)
	})

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	let {port} = server.address() as AddressInfo
	return (path: string) => fetch(`http://localhost:${port}${path}`)
}

/// An upstream that answers only when told to, and counts its calls.
function slowUpstream() {
	let calls: string[] = []
	let {promise: released, resolve: release} = Promise.withResolvers<void>()
	let fetchUpstream = async (path: string) => {
		calls.push(path)
		await released
		return {path}
	}
	return {calls, release, fetchUpstream}
}

void test('concurrent misses for one key share one upstream fetch', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream()
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await new Promise((resolve) => setTimeout(resolve, 50))
	release()

	let bodies = await Promise.all((await responses).map((r) => r.json()))
	t.assert.deepEqual(calls, ['/menu'])
	t.assert.deepEqual(bodies, [{path: '/menu'}, {path: '/menu'}, {path: '/menu'}])
})

void test('concurrent misses for different keys fetch separately', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream()
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/a'), get('/b')])
	await new Promise((resolve) => setTimeout(resolve, 50))
	release()
	await responses

	t.assert.deepEqual(calls.toSorted(), ['/a', '/b'])
})

void test('routes that do not cache are not held up behind each other', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream()
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/uncached'), get('/uncached')])
	await new Promise((resolve) => setTimeout(resolve, 50))
	t.assert.equal(calls.length, 2)
	release()
	await responses
})

void test('a waiting request fetches for itself when the first one fails', async (t) => {
	let calls = 0
	let {promise: released, resolve: release} = Promise.withResolvers<void>()
	let get = await serve(t, async () => {
		calls += 1
		await released
		if (calls === 1) throw new Error('upstream down')
		return {ok: true}
	})
	t.mock.method(console, 'error', () => undefined)

	let responses = Promise.all([get('/menu'), get('/menu')])
	await new Promise((resolve) => setTimeout(resolve, 50))
	release()

	let statuses = (await responses).map((r) => r.status)
	t.assert.deepEqual(statuses, [500, 200])
	t.assert.equal(calls, 2)
})
