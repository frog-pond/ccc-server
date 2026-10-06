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
		before?: Koa.Middleware
		stream?: PassThrough
		shareFetch?: (ctx: Koa.ExtendableContext) => boolean
		onBurst?: (ctx: Koa.ExtendableContext, shared: boolean) => void
		onLookup?: (ctx: Koa.ExtendableContext, hit: boolean) => void
		onFillEnd?: (ctx: Koa.ExtendableContext, outcome: string, waiters: number) => void
		onStore?: (ctx: Koa.ExtendableContext, body: unknown) => void
		expiresIn?: (key: string) => number | undefined
		storedHeaders?: string[]
	} = {},
) {
	let store = new Map<string, CacheObject>()
	let app = new Koa()
	app.use(
		cachable({
			get: (key) => store.get(key),
			set: (key, value) => (value ? store.set(key, value) : store.delete(key)),
			statusName: 'test-cache',
			...(options.expiresIn && {expiresIn: options.expiresIn}),
			...(options.hash && {hash: options.hash}),
			...(options.shareFetch && {shareFetch: options.shareFetch}),
			...(options.onBurst && {onBurst: options.onBurst}),
			...(options.onLookup && {onLookup: options.onLookup}),
			...(options.onFillEnd && {onFillEnd: options.onFillEnd}),
			...(options.onStore && {onStore: options.onStore}),
			...(options.storedHeaders && {storedHeaders: options.storedHeaders}),
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
		if (ctx.path.startsWith('/linked')) {
			ctx.set('Link', `<${ctx.path}?page=2>; rel="next"`)
			// a header about this one response, which a cached copy must not give back
			ctx.set('X-Request-Only', 'first')
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
	return (path: string, init?: RequestInit) =>
		fetch(`http://localhost:${String(port)}${path}`, init)
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

void test('a route that does not cache streams its body without buffering', async (t) => {
	let stream = new PassThrough()
	let get = await serve(t, () => Promise.resolve(undefined), {stream})

	stream.write('first chunk')
	let response = await Promise.race([get('/stream'), tick(200).then(() => 'still buffering')])
	t.assert.notEqual(response, 'still buffering')
	stream.end()
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

void test('a stream of Uint8Array chunks is cached and shared as bytes', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, async (path) => {
		await fetchUpstream(path)
		// an object-mode stream that yields plain Uint8Arrays, not buffers
		let stream = new PassThrough({objectMode: true})
		stream.write(new TextEncoder().encode('menu '))
		stream.end(new TextEncoder().encode('of the day'))
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

void test('every lookup is told whether it hit the cache', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let told: boolean[] = []
	let get = await serve(t, fetchUpstream, {onLookup: (_ctx, hit) => told.push(hit)})
	release()

	await get('/menu')
	await get('/menu')
	await get('/uncached')
	t.assert.deepEqual(told, [false, true], 'a route that does not cache does not look up')
})

void test('a fill is told how it ended, and how many waited on it', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let told: [string, number][] = []
	let get = await serve(t, fetchUpstream, {
		onFillEnd: (_ctx, outcome, waiters) => told.push([outcome, waiters]),
	})

	let burst = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	release()
	await burst
	t.assert.deepEqual(told, [['stored', 2]])
})

void test('a fill that answers without caching is told it was replayed', async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let told: [string, number][] = []
	let get = await serve(t, upstream.fetchUpstream, {
		onFillEnd: (_ctx, outcome, waiters) => told.push([outcome, waiters]),
	})

	let burst = Promise.all([get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()
	await burst
	t.assert.deepEqual(told, [['replay', 1]])
})

void test('a fill that fails is told so', async (t) => {
	let upstream = slowUpstream(t, () => {
		throw new Error('upstream down')
	})
	let told: [string, number][] = []
	let get = await serve(t, upstream.fetchUpstream, {
		onFillEnd: (_ctx, outcome, waiters) => told.push([outcome, waiters]),
	})
	t.mock.method(console, 'error', () => undefined)

	let burst = Promise.all([get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()
	await burst
	t.assert.deepEqual(told, [['error', 1]])
})

void test('a lookup hook that throws does not fail the request', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {
		onLookup: () => {
			throw new Error('hook broke')
		},
	})
	let logged = t.mock.method(console, 'error', () => undefined)
	release()

	let first = await get('/menu')
	t.assert.equal(first.status, 200)
	let second = await get('/menu')
	t.assert.equal(second.status, 200)
	t.assert.equal(second.headers.get('Cache-Status'), 'test-cache; hit')
	t.assert.deepEqual(await second.json(), {path: '/menu'})
	t.assert.equal(logged.mock.callCount(), 1, 'a broken hook is logged once, not every time')
})

void test('a fill hook that throws does not change how the fill ends', async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let get = await serve(t, upstream.fetchUpstream, {
		onFillEnd: () => {
			throw new Error('hook broke')
		},
	})
	t.mock.method(console, 'error', () => undefined)

	let burst = Promise.all([get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()
	t.assert.deepEqual(
		(await burst).map((r) => r.status),
		[404, 404],
	)
})

void test('a stored response is told with its body, once per fetch rather than per request', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t, () => [1, 2, 3])
	let told: unknown[] = []
	let get = await serve(t, fetchUpstream, {onStore: (_ctx, body) => told.push(body)})

	let burst = Promise.all([get('/menu'), get('/menu'), get('/menu')])
	await tick()
	release()
	await burst
	await get('/menu')

	t.assert.equal(calls.length, 1)
	t.assert.deepEqual(told, [[1, 2, 3]], 'the body as the route set it, before it is serialized')
})

void test('a response the cache does not hold is not told as stored', async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let told: unknown[] = []
	let get = await serve(t, upstream.fetchUpstream, {onStore: (_ctx, body) => told.push(body)})
	upstream.releaseFirst()

	t.assert.equal((await get('/menu')).status, 404)
	t.assert.deepEqual(told, [])
})

void test('a store hook that throws does not keep the response from being cached', async (t) => {
	let {calls, release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {
		onStore: () => {
			throw new Error('hook broke')
		},
	})
	t.mock.method(console, 'error', () => undefined)
	release()

	t.assert.equal((await get('/menu')).status, 200)
	t.assert.deepEqual(await (await get('/menu')).json(), {path: '/menu'})
	t.assert.equal(calls.length, 1, 'the second request was served from the cache')
})

void test('a response fetched and stored says so in Cache-Status', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream)
	release()

	let response = await get('/menu')
	t.assert.equal(response.headers.get('Cache-Status'), 'test-cache; fwd=uri-miss; stored')
})

void test('a response served from the cache says so in Cache-Status, with its ttl', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {expiresIn: () => 42_900})
	release()

	await get('/menu')
	let response = await get('/menu')
	t.assert.equal(response.headers.get('Cache-Status'), 'test-cache; hit; ttl=42')
})

void test('a hit on a key that never expires leaves ttl out', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {expiresIn: () => Number.POSITIVE_INFINITY})
	release()

	await get('/menu')
	let response = await get('/menu')
	t.assert.equal(response.headers.get('Cache-Status'), 'test-cache; hit')
})

void test('a response fetched but not stored says only that it went upstream', async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let get = await serve(t, upstream.fetchUpstream)
	upstream.releaseFirst()

	let response = await get('/menu')
	t.assert.equal(response.status, 404)
	t.assert.equal(response.headers.get('Cache-Status'), 'test-cache; fwd=uri-miss')
})

/// Gives every response the same Last-Modified, so a request that sends it back
/// in If-Modified-Since is answered with a 304.
const LAST_MODIFIED = new Date('2026-01-01T00:00:00Z')
const lastModified: Koa.Middleware = async (ctx, next) => {
	await next()
	ctx.lastModified = LAST_MODIFIED
}
/// fetch sends a conditional request with Cache-Control: no-cache, which Koa
/// never answers with a 304; `cache: 'no-cache'` sends max-age=0 instead.
const ifModifiedSince: RequestInit = {
	headers: {'If-Modified-Since': LAST_MODIFIED.toUTCString()},
	cache: 'no-cache',
}

void test('a fetched response answered with a 304 gives the 200 it stored as fwd-status', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {before: lastModified})
	release()

	let response = await get('/menu', ifModifiedSince)
	t.assert.equal(response.status, 304)
	t.assert.equal(
		response.headers.get('Cache-Status'),
		'test-cache; fwd=uri-miss; stored; fwd-status=200',
	)
})

void test('a 304 served from the cache is still a hit', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {before: lastModified})
	release()

	await get('/menu')
	let response = await get('/menu', ifModifiedSince)
	t.assert.equal(response.status, 304)
	t.assert.equal(response.headers.get('Cache-Status'), 'test-cache; hit')
})

/// The Cache-Status of each response, in order, since the requests in a burst
/// can reach the server in any order.
const cacheStatuses = (responses: Response[]) =>
	responses.map((r) => r.headers.get('Cache-Status')).toSorted()

void test('waiters that shared a stored fetch say they were collapsed', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream)

	let burst = Promise.all([get('/menu'), get('/menu')])
	await tick()
	release()
	t.assert.deepEqual(cacheStatuses(await burst), [
		'test-cache; fwd=uri-miss; collapsed; stored',
		'test-cache; fwd=uri-miss; stored',
	])
})

void test('waiters that shared a fetch the cache did not hold say they were collapsed', async (t) => {
	let upstream = slowUpstream(t, () => undefined)
	let get = await serve(t, upstream.fetchUpstream)

	let burst = Promise.all([get('/menu'), get('/menu')])
	await tick()
	upstream.releaseFirst()
	let responses = await burst
	t.assert.deepEqual(
		responses.map((r) => r.status),
		[404, 404],
	)
	t.assert.deepEqual(cacheStatuses(responses), [
		'test-cache; fwd=uri-miss',
		'test-cache; fwd=uri-miss; collapsed',
	])
})

void test('a route that does not cache has no Cache-Status', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream)
	release()

	let response = await get('/uncached')
	t.assert.equal(response.headers.get('Cache-Status'), null)
})

void test('a hit gives back the headers the cache was told to store, and no others', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {storedHeaders: ['link']})
	release()

	await get('/linked')
	let response = await get('/linked')
	t.assert.equal(response.headers.get('Cache-Status'), 'test-cache; hit')
	t.assert.equal(response.headers.get('Link'), '</linked?page=2>; rel="next"')
	t.assert.equal(response.headers.get('X-Request-Only'), null)
})

void test('waiters on a stored fill get its stored headers', async (t) => {
	let {releaseFirst, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream, {storedHeaders: ['link']})

	let first = get('/linked')
	await tick()
	let second = get('/linked')
	await tick()
	releaseFirst()

	let [, waiter] = await Promise.all([first, second])
	t.assert.equal(waiter.headers.get('Link'), '</linked?page=2>; rel="next"')
})

void test('without storedHeaders, a hit gives back none of the headers it was fetched with', async (t) => {
	let {release, fetchUpstream} = slowUpstream(t)
	let get = await serve(t, fetchUpstream)
	release()

	await get('/linked')
	let response = await get('/linked')
	t.assert.equal(response.headers.get('Link'), null)
})
