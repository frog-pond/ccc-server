import {test} from 'node:test'
import type {AddressInfo} from 'node:net'
import Koa from 'koa'
import {cachable, type CacheObject} from './cache.ts'

type Upstream = (path: string) => Promise<unknown>

/// A server whose one route caches, and fetches upstream through `fetchUpstream`.
/// An upstream answer of `undefined` is a 404.
async function serve(
	t: test.TestContext,
	fetchUpstream: Upstream,
	options: {
		hash?: (ctx: Koa.ExtendableContext) => string
		fillWaitTimeout?: number
		before?: Koa.Middleware
	} = {},
) {
	let store = new Map<string, CacheObject>()
	let app = new Koa()
	app.use(
		cachable({
			get: (key) => store.get(key),
			set: (key, value) => (value ? store.set(key, value) : store.delete(key)),
			...(options.hash && {hash: options.hash}),
			...(options.fillWaitTimeout && {fillWaitTimeout: options.fillWaitTimeout}),
		}),
	)
	if (options.before) app.use(options.before)
	app.use(async (ctx) => {
		if (ctx.path === '/uncached') {
			ctx.body = await fetchUpstream(ctx.path)
			return
		}
		if (ctx.cached(60_000)) return
		let body = await fetchUpstream(ctx.path)
		if (body === undefined) {
			ctx.status = 404
			return
		}
		ctx.body = body
	})

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	let {port} = server.address() as AddressInfo
	return (path: string) => fetch(`http://localhost:${String(port)}${path}`)
}

/// An upstream that answers only when told to, and counts its calls. The first
/// call answers with `first`, later ones with `{path}`, each when released.
function slowUpstream(first: (path: string) => unknown = (path) => ({path})) {
	let calls: string[] = []
	let firstGate = Promise.withResolvers<undefined>()
	let laterGate = Promise.withResolvers<undefined>()
	let fetchUpstream: Upstream = async (path) => {
		calls.push(path)
		if (calls.length === 1) {
			await firstGate.promise
			return first(path)
		}
		await laterGate.promise
		return {path}
	}
	return {
		calls,
		fetchUpstream,
		releaseFirst: () => {
			firstGate.resolve(undefined)
		},
		releaseLater: () => {
			laterGate.resolve(undefined)
		},
		release: () => {
			firstGate.resolve(undefined)
			laterGate.resolve(undefined)
		},
	}
}

const tick = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

void test('concurrent misses for one key share one upstream fetch', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream()
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	release()

	let bodies = await Promise.all((await responses).map((r) => r.json()))
	t.assert.deepEqual(calls, ['/menu'])
	t.assert.deepEqual(bodies, [{path: '/menu'}, {path: '/menu'}, {path: '/menu'}])
})

void test('concurrent misses for different keys fetch separately', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream()
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/a'), get('/b')])
	await tick()
	release()
	await responses

	t.assert.deepEqual(calls.toSorted(), ['/a', '/b'])
})

void test('routes that do not cache are not held up behind each other', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream()
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/uncached'), get('/uncached')])
	await tick()
	t.assert.equal(calls.length, 2)
	release()
	await responses
})

void test('when the first request fails, its waiters all fetch at once', async (t) => {
	let upstream = slowUpstream(() => {
		throw new Error('upstream down')
	})
	let get = await serve(t, upstream.fetchUpstream)
	t.mock.method(console, 'error', () => undefined)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()
	await tick()
	// Every waiter is fetching, rather than one at a time behind a new filler.
	t.assert.equal(upstream.calls.length, 4)
	upstream.releaseLater()

	let statuses = (await responses).map((r) => r.status)
	t.assert.deepEqual(statuses, [500, 200, 200, 200])
})

void test('a request arriving while waiters retry a 404 does not queue behind them', async (t) => {
	let upstream = slowUpstream(() => undefined)
	let get = await serve(t, upstream.fetchUpstream)

	let responses = [get('/menu'), get('/menu'), get('/menu')]
	await tick()
	upstream.releaseFirst()
	await tick()
	t.assert.equal(upstream.calls.length, 3)

	// The waiters are retrying. A new request fetches at once, rather than
	// waiting on one of them as though it were filling the cache.
	responses.push(get('/menu'))
	await tick()
	t.assert.equal(upstream.calls.length, 4)
	upstream.releaseLater()

	let statuses = (await Promise.all(responses)).map((r) => r.status)
	t.assert.deepEqual(statuses, [404, 200, 200, 200])
})

void test('a waiter stops waiting on a fill that hangs, and fetches for itself', async (t) => {
	let upstream = slowUpstream()
	let get = await serve(t, upstream.fetchUpstream, {fillWaitTimeout: 100})

	let first = get('/menu')
	await tick()
	let second = get('/menu')
	await tick(20)
	t.assert.equal(upstream.calls.length, 1, 'still waiting before the timeout')
	await tick(150)
	t.assert.equal(upstream.calls.length, 2, 'fetching for itself after the timeout')

	upstream.releaseLater()
	t.assert.equal((await second).status, 200)
	upstream.releaseFirst()
	t.assert.equal((await first).status, 200)
})

void test('the key is hashed once, before later middleware can change it', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream()
	let get = await serve(t, fetchUpstream, {
		hash: (ctx) => `${ctx.get('x-cache-key')}:${ctx.url}`,
		before: async (ctx, next) => {
			ctx.request.headers['x-cache-key'] = 'later'
			await next()
		},
	})

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	release()
	await responses

	t.assert.deepEqual(calls, ['/menu'])
})
