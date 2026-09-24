import type {MiddlewareHandler} from 'hono'
import {etag} from 'hono/etag'
import type {AppEnv} from './env.ts'

export const CACHE_HIT_HEADER = 'X-Cached-Response'

export function publicMaxAge(ms: number): string {
	return `public, max-age=${Math.round(ms / 1000).toFixed(0)}`
}

// lib.dom's CacheStorage type doesn't know about the Workers-only `default`
// cache, so the global `caches` needs a cast to reach it.
const defaultCache = (caches as unknown as {default: Cache}).default

const addEtag = etag()

/// Serves a route from this data center's cache, or runs it and stores a 200
/// for `ms` milliseconds. A handler that sets its own Cache-Control keeps it,
/// which is how a route shortens its TTL for one response.
export function cacheFor(ms: number): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		// Hono answers HEAD with GET handlers, but the Cache API only stores GETs
		if (c.req.raw.method !== 'GET') {
			await addEtag(c, next)
			return
		}

		// match() answers a matching If-None-Match with a 304 itself
		let hit = await defaultCache.match(c.req.raw)
		if (hit) {
			let response = new Response(hit.body, hit)
			response.headers.set(CACHE_HIT_HEADER, 'HIT')
			return response
		}

		// the ETag has to be on the response before it is stored, or match()
		// can never answer If-None-Match with a 304
		await addEtag(c, next)

		if (c.res.status !== 200) {
			return
		}
		if (!c.res.headers.has('Cache-Control')) {
			c.header('Cache-Control', publicMaxAge(ms))
		}
		// awaited rather than left to waitUntil: a put is a local write, and
		// awaiting it means the very next request is guaranteed to hit
		await defaultCache.put(c.req.raw, c.res.clone())
		return
	}
}
