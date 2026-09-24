import {Hono} from 'hono'
import {createApp} from '../source/ccc-worker/app.ts'
import {cacheFor, publicMaxAge} from '../source/ccc-worker/cache.ts'
import type {AppEnv} from '../source/ccc-worker/env.ts'
import {ONE_HOUR, ONE_MINUTE} from '../source/ccc-lib/constants.ts'

/// A Worker with one route per cache behavior, so cache.test.ts can check
/// cacheFor in the real runtime without depending on any school's routes.

let api = new Hono<AppEnv>().basePath('/v1')

api.get('/cached', cacheFor(ONE_HOUR), async (c) => {
	let response = await fetch('https://upstream.test/data')
	return c.json(await response.json())
})

api.get('/echo', cacheFor(ONE_HOUR), async (c) => {
	let response = await fetch(`https://upstream.test/echo?q=${c.req.query('q') ?? ''}`)
	return c.json(await response.json())
})

api.get('/short', cacheFor(ONE_HOUR), async (c) => {
	await fetch('https://upstream.test/short')
	c.header('Cache-Control', publicMaxAge(ONE_MINUTE))
	return c.json({short: true})
})

api.get('/plain', (c) => c.json({plain: true}))

api.get('/fails', cacheFor(ONE_HOUR), async (c) => {
	let response = await fetch('https://upstream.test/fails')
	return c.json({upstream: response.status}, 502)
})

let app = createApp(api)

// test-only: reads the cache directly, so a test can pin what cacheFor
// actually stored rather than only what a later request happens to return
app.get('/stored-etag', async (c) => {
	let path = c.req.query('path') ?? ''
	// lib.dom's CacheStorage type doesn't know about the Workers-only `default`
	// cache, so the global `caches` needs a cast to reach it.
	let defaultCache = (caches as unknown as {default: Cache}).default
	let stored = await defaultCache.match(`http://localhost${path}`)
	return c.json({etag: stored?.headers.get('ETag') ?? null})
})

export default app
