import {test} from 'node:test'
import type {AddressInfo} from 'node:net'
import Koa from 'koa'
import {PassThrough} from 'node:stream'
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
		stream?: PassThrough
		shareFetch?: (ctx: Koa.ExtendableContext) => boolean
		onBurst?: (ctx: Koa.ExtendableContext, shared: boolean) => void
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
			...(options.shareFetch && {shareFetch: options.shareFetch}),
			...(options.onBurst && {onBurst: options.onBurst}),
		}),
	)
	if (options.before) app.use(options.before)
	app.use(async (ctx) => {
		if (ctx.path === '/stream') {
			ctx.body = options.stream
			return
		}
		if (ctx.path === '/uncached') {
			ctx.body = await fetchUpstream(ctx.path)
			return
		}
		if (ctx.cached(60_000)) return
		let body = await fetchUpstream(ctx.path)
		if (body === undefined) {
			ctx.set('Cache-Control', 'max-age=60')
			ctx.set('Set-Cookie', 'session=first')
			ctx.status = 404
			return
		}
		if (body === '') {
			// a 200 the cache won't hold
			ctx.body = ''
			return
		}
		ctx.body = body
	})

	let server = app.listen(0)
	t.after(() => {
		// a failed assertion can leave a request waiting on its upstream
		server.closeAllConnections()
		server.close()
	})
	await new Promise((resolve) => server.once('listening', resolve))
	let {port} = server.address() as AddressInfo
	return (path: string) => fetch(`http://localhost:${String(port)}${path}`)
}

/// An upstream that answers only when told to, and counts its calls. The first
/// call answers with `first`, later ones with `{path}`, each when released.
function slowUpstream(t: test.TestContext, first: (path: string) => unknown = (path) => ({path})) {
	let calls: string[] = []
	let firstGate = Promise.withResolvers<undefined>()
	let laterGate = Promise.withResolvers<undefined>()
	t.after(() => {
		firstGate.resolve(undefined)
		laterGate.resolve(undefined)
	})
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
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	release()

	let bodies = await Promise.all((await responses).map((r) => r.json()))
	t.assert.deepEqual(calls, ['/menu'])
	t.assert.deepEqual(bodies, [{path: '/menu'}, {path: '/menu'}, {path: '/menu'}])
})

void test('concurrent misses for different keys fetch separately', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/a'), get('/b')])
	await tick()
	release()
	await responses

	t.assert.deepEqual(calls.toSorted(), ['/a', '/b'])
})

void test('routes that do not cache are not held up behind each other', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream)

	let responses = Promise.all([get('/uncached'), get('/uncached')])
	await tick()
	t.assert.equal(calls.length, 2)
	release()
	await responses
})

void test('when the first request fails, its waiters fail the same way without fetching', async (t) => {
	let upstream = slowUpstream(t, () => {
		throw new Error('upstream down')
	})
	let get = await serve(t, upstream.fetchUpstream)
	t.mock.method(console, 'error', () => undefined)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()

	let statuses = (await responses).map((r) => r.status)
	t.assert.deepEqual(statuses, [500, 500, 500, 500])
	t.assert.equal(upstream.calls.length, 1)
})

void test('when the first request is a 404, its waiters answer the same without fetching', async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let get = await serve(t, upstream.fetchUpstream)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()

	let answers = (await responses).map((r) => [r.status, r.headers.get('Cache-Control')])
	t.assert.deepEqual(answers, [
		[404, 'max-age=60'],
		[404, 'max-age=60'],
		[404, 'max-age=60'],
	])
	t.assert.equal(upstream.calls.length, 1)
})

void test("waiters don't take the first response's cookies", async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let get = await serve(t, upstream.fetchUpstream)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()

	let cookies = (await responses).map((r) => r.headers.get('Set-Cookie'))
	t.assert.deepEqual(cookies.toSorted(), [null, null, 'session=first'])
})

void test('when the first response is a 200 the cache will not hold, waiters share it', async (t) => {
	let upstream = slowUpstream(t, () => '')
	let get = await serve(t, upstream.fetchUpstream)

	let responses = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()

	let statuses = (await responses).map((r) => r.status)
	t.assert.deepEqual(statuses, [200, 200, 200])
	t.assert.equal(upstream.calls.length, 1)
})

void test('after a fill ends, the next request starts a fill of its own', async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let get = await serve(t, upstream.fetchUpstream)

	let first = get('/menu')
	await tick()
	upstream.releaseFirst()
	t.assert.equal((await first).status, 404)

	upstream.releaseLater()
	t.assert.equal((await get('/menu')).status, 200)
	t.assert.equal(upstream.calls.length, 2)
})

void test('a waiter takes over a fill that hangs', async (t) => {
	let upstream = slowUpstream(t)
	let get = await serve(t, upstream.fetchUpstream, {fillWaitTimeout: 100})

	let first = get('/menu')
	await tick()
	let second = get('/menu')
	await tick(20)
	t.assert.equal(upstream.calls.length, 1, 'still waiting before the fill hangs')
	await tick(150)
	t.assert.equal(upstream.calls.length, 2, 'fetching once the fill has hung')

	upstream.releaseLater()
	t.assert.equal((await second).status, 200)
	upstream.releaseFirst()
	t.assert.equal((await first).status, 200)
})

void test('when a fill hangs, one waiter takes it over and the rest wait on that', async (t) => {
	let upstream = slowUpstream(t)
	let get = await serve(t, upstream.fetchUpstream, {fillWaitTimeout: 100})

	let first = get('/menu')
	await tick()
	let waiters = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	// between the first fill hanging (100 ms) and the takeover hanging (200 ms)
	await tick(100)
	t.assert.equal(upstream.calls.length, 2, 'one takeover, not one fetch per waiter')

	upstream.releaseLater()
	t.assert.deepEqual(
		(await waiters).map((r) => r.status),
		[200, 200, 200],
	)
	upstream.releaseFirst()
	await first
})

void test('a copy stored by the hung request lets its takeover’s waiters go', async (t) => {
	let upstream = slowUpstream(t)
	let get = await serve(t, upstream.fetchUpstream, {fillWaitTimeout: 100})

	let first = get('/menu')
	await tick()
	let taker = get('/menu')
	let follower = get('/menu')
	await tick(100)
	t.assert.equal(upstream.calls.length, 2)

	// The hung request finishes after all, while the takeover is still out.
	upstream.releaseFirst()
	t.assert.equal((await first).status, 200)
	t.assert.equal((await follower).status, 200)

	upstream.releaseLater()
	t.assert.equal((await taker).status, 200)
})

void test('once a takeover stores a copy, later requests do not wait on the hung fill', async (t) => {
	let upstream = slowUpstream(t)
	let get = await serve(t, upstream.fetchUpstream, {fillWaitTimeout: 100})

	let first = get('/menu')
	await tick()
	let taker = get('/menu')
	await tick(100)
	upstream.releaseLater()
	t.assert.equal((await taker).status, 200)

	let started = Date.now()
	t.assert.equal((await get('/menu')).status, 200)
	let elapsed = Date.now() - started
	t.assert.equal(
		elapsed < 50,
		true,
		`served from the cache, without waiting (took ${String(elapsed)} ms)`,
	)
	t.assert.equal(upstream.calls.length, 2)

	upstream.releaseFirst()
	await first
})

void test('a route that does not cache streams its body without buffering', async (t) => {
	let stream = new PassThrough()
	let get = await serve(t, () => Promise.resolve(undefined), {stream})

	stream.write('first chunk')
	let response = await Promise.race([get('/stream'), tick(200).then(() => 'still buffering')])
	t.assert.notEqual(response, 'still buffering')
	stream.end()
})

void test('when a takeover hangs too, one follower takes over and the rest fetch for themselves', async (t) => {
	let calls = 0
	let gate = Promise.withResolvers<undefined>()
	t.after(() => {
		gate.resolve(undefined)
	})
	let get = await serve(
		t,
		async (path) => {
			calls += 1
			await gate.promise
			return {path}
		},
		{fillWaitTimeout: 100},
	)

	let first = get('/menu')
	await tick()
	// arrive before the first fill hangs, at 100 ms
	let followers = [get('/menu'), get('/menu'), get('/menu')]
	await tick(100)
	t.assert.equal(calls, 2, 'one takeover when the first fill hangs')
	await tick(100)
	// the takeover hung at about 200 ms: one follower took over in turn, and
	// the other fetched for itself
	t.assert.equal(calls, 4)

	gate.resolve(undefined)
	let statuses = (await Promise.all([first, ...followers])).map((r) => r.status)
	t.assert.deepEqual(statuses, [200, 200, 200, 200])
})

void test('a stream of string chunks is cached and shared', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, async (path) => {
		await fetchUpstream(path)
		// a stream that yields strings, not buffers
		let stream = new PassThrough({encoding: 'utf8'})
		stream.end('menu of the day')
		return stream
	})

	let responses = Promise.all([get('/menu'), get('/menu')])
	await tick()
	release()

	let bodies = await Promise.all((await responses).map((r) => r.text()))
	t.assert.deepEqual(bodies, ['menu of the day', 'menu of the day'])
	t.assert.equal(calls.length, 1)
})

void test('in a burst that does not share, every request fetches for itself, as before', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let told: boolean[] = []
	let get = await serve(t, fetchUpstream, {
		shareFetch: () => false,
		onBurst: (_ctx, shared) => told.push(shared),
	})

	let first = get('/menu')
	await tick()
	let rest = [get('/menu'), get('/menu')]
	await tick()
	t.assert.equal(calls.length, 3)
	release()

	let statuses = (await Promise.all([first, ...rest])).map((r) => r.status)
	t.assert.deepEqual(statuses, [200, 200, 200])
	t.assert.deepEqual(told, [false, false, false])
})

void test('a burst is decided once, by its first miss, for every request in it', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let asked = 0
	let told: boolean[] = []
	let get = await serve(t, fetchUpstream, {
		// would share, for every request after the first
		shareFetch: () => asked++ > 0,
		onBurst: (_ctx, shared) => told.push(shared),
	})

	let first = get('/menu')
	await tick()
	let rest = [get('/menu'), get('/menu')]
	await tick()
	// the first said not to share, so the rest fetch too, without asking
	t.assert.equal(asked, 1)
	t.assert.equal(calls.length, 3)
	release()
	await Promise.all([first, ...rest])
	t.assert.deepEqual(told, [false, false, false])
})

void test('every request in a burst that shares is told so, and a cache hit is not told', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let told: boolean[] = []
	let get = await serve(t, fetchUpstream, {onBurst: (_ctx, shared) => told.push(shared)})

	let burst = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	release()
	await burst
	t.assert.deepEqual(told, [true, true, true])
	t.assert.equal(calls.length, 1)

	t.assert.equal((await get('/menu')).status, 200)
	t.assert.equal(told.length, 3, 'served from the cache, so not in a burst')
})

void test('the next burst after one that did not share is decided afresh', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	release()
	let decisions = [false, true]
	let asked = 0
	let get = await serve(t, fetchUpstream, {
		shareFetch: () => {
			asked += 1
			return decisions.shift() ?? true
		},
	})

	await get('/a')
	await get('/b')
	t.assert.equal(asked, 2)
})

void test('the key is hashed once, before later middleware can change it', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
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
