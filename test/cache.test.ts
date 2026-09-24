import {test, type TestContext} from 'node:test'
import {Response, type Request, type RequestInit} from 'miniflare'
import {bundle, startWorker} from './harness.ts'

let scriptPath = bundle(['--config', 'test/cache-worker.wrangler.toml'], 'cache-worker')

/// Counts outbound requests by path+query and answers each with JSON naming it.
function countingUpstream() {
	let hits = new Map<string, number>()
	let upstream = (request: Request) => {
		let url = new URL(request.url)
		let key = url.pathname + url.search
		hits.set(key, (hits.get(key) ?? 0) + 1)
		if (url.pathname === '/fails') {
			return new Response('down', {status: 503})
		}
		return Response.json({path: key})
	}
	return {hits, upstream}
}

async function worker(t: TestContext) {
	let {hits, upstream} = countingUpstream()
	let mf = await startWorker({scriptPath, bindings: {}, upstream})
	t.after(() => mf.dispose())
	let get = async (path: string, init?: RequestInit) => {
		let response = await mf.dispatchFetch(`http://localhost${path}`, init)
		let body = await response.text()
		return {response, body}
	}
	return {hits, get}
}

void test('a second request is served from the cache', async (t) => {
	let {hits, get} = await worker(t)
	let first = await get('/v1/cached')
	let second = await get('/v1/cached')
	t.assert.equal(first.response.headers.get('X-Cached-Response'), null)
	t.assert.equal(second.response.headers.get('X-Cached-Response'), 'HIT')
	t.assert.equal(second.body, first.body)
	t.assert.equal(hits.get('/data'), 1)
})

void test('a cached route sends the route TTL as Cache-Control', async (t) => {
	let {get} = await worker(t)
	let {response} = await get('/v1/cached')
	t.assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600')
})

void test('a handler that sets Cache-Control keeps it', async (t) => {
	let {get} = await worker(t)
	let {response} = await get('/v1/short')
	t.assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60')
})

void test('a cached response answers a matching If-None-Match with 304', async (t: TestContext) => {
	let {hits, get} = await worker(t)
	let first = await get('/v1/cached')
	let etag: string | null = first.response.headers.get('ETag')
	t.assert.ok(etag, 'the first response has an ETag')
	await get('/v1/cached')
	let conditional = await get('/v1/cached', {headers: {'If-None-Match': etag}})
	t.assert.equal(conditional.response.status, 304)
	t.assert.equal(hits.get('/data'), 1, 'the 304 came from the cache, not a re-run handler')
})

void test('a route without cacheFor still answers a matching If-None-Match with 304', async (t: TestContext) => {
	let {get} = await worker(t)
	let first = await get('/v1/plain')
	let etag: string | null = first.response.headers.get('ETag')
	t.assert.ok(etag, 'the app-wide etag middleware set one')
	let conditional = await get('/v1/plain', {headers: {'If-None-Match': etag}})
	t.assert.equal(conditional.response.status, 304)
})

void test('the stored response carries the ETag it was cached with', async (t: TestContext) => {
	let {get} = await worker(t)
	let first = await get('/v1/cached')
	let etag = first.response.headers.get('ETag')
	t.assert.ok(etag, 'the first response has an ETag')
	let stored = await get('/stored-etag?path=/v1/cached')
	let storedEtag = (JSON.parse(stored.body) as {etag: string | null}).etag
	t.assert.equal(storedEtag, etag)
})

void test('a stored response and a fresh one carry the same ETag', async (t) => {
	let {get} = await worker(t)
	let first = await get('/v1/cached')
	let second = await get('/v1/cached')
	t.assert.equal(second.response.headers.get('X-Cached-Response'), 'HIT')
	t.assert.equal(second.response.headers.get('ETag'), first.response.headers.get('ETag'))
})

void test('different query strings are cached separately', async (t) => {
	let {hits, get} = await worker(t)
	let a = await get('/v1/echo?q=a')
	let b = await get('/v1/echo?q=b')
	await get('/v1/echo?q=a')
	t.assert.notEqual(a.body, b.body)
	t.assert.equal(hits.get('/echo?q=a'), 1)
	t.assert.equal(hits.get('/echo?q=b'), 1)
})

void test('an error response is not cached', async (t) => {
	let {hits, get} = await worker(t)
	let first = await get('/v1/fails')
	await get('/v1/fails')
	t.assert.equal(first.response.status, 502)
	t.assert.equal(hits.get('/fails'), 2)
})

void test('HEAD on a cached route answers 200 and does not break later GETs', async (t) => {
	let {hits, get} = await worker(t)
	let head = await get('/v1/cached', {method: 'HEAD'})
	t.assert.equal(head.response.status, 200)
	t.assert.equal(head.body, '')
	let after = await get('/v1/cached')
	t.assert.equal(after.response.status, 200)
	t.assert.equal(hits.get('/data'), 2, 'HEAD ran the handler without storing')
})

void test('/ping answers pong', async (t) => {
	let {get} = await worker(t)
	let {response, body} = await get('/ping')
	t.assert.equal(response.status, 200)
	t.assert.equal(body, 'pong')
})

// A client revalidating a stale copy sends If-None-Match to a data center that
// may not have the route cached yet; that request still has to fill the cache.
void test('a conditional request on a cold cache answers 304 and fills the cache', async (t) => {
	let elsewhere = await worker(t)
	let etag = (await elsewhere.get('/v1/cached')).response.headers.get('ETag')
	if (!etag) throw new Error('the first response has no ETag')

	let {hits, get} = await worker(t)
	let conditional = await get('/v1/cached', {headers: {'If-None-Match': etag}})
	let after = await get('/v1/cached')
	t.assert.equal(conditional.response.status, 304)
	t.assert.equal(after.response.headers.get('X-Cached-Response'), 'HIT')
	t.assert.equal(hits.get('/data'), 1)
})

void test('a response marked no-store is not cached', async (t) => {
	let {hits, get} = await worker(t)
	let first = await get('/v1/no-store')
	let second = await get('/v1/no-store')
	t.assert.equal(first.response.status, 200)
	t.assert.equal(second.response.headers.get('X-Cached-Response'), null)
	t.assert.equal(hits.get('/no-store'), 2)
})
