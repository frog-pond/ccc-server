import type {MiddlewareHandler} from 'hono'
import type {AppEnv} from './env.ts'

export const CACHE_HIT_HEADER = 'X-Cached-Response'

export function publicMaxAge(ms: number): string {
	return `public, max-age=${Math.round(ms / 1000).toFixed(0)}`
}

// lib.dom's CacheStorage type doesn't know about the Workers-only `default`
// cache, so the global `caches` needs a cast to reach it.
const defaultCache = (caches as unknown as {default: Cache}).default

/// A strong ETag from the body's SHA-1, the same form Hono's etag middleware
/// uses, so the app-wide middleware keeps it and answers If-None-Match with it.
async function bodyEtag(response: Response): Promise<string> {
	let digest = await crypto.subtle.digest('SHA-1', await response.arrayBuffer())
	let hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
	return `"${hex.join('')}"`
}

/// Serves a route from this data center's cache, or runs it and stores a 200
/// for `ms` milliseconds. A handler that sets its own Cache-Control keeps it,
/// which is how a route shortens its TTL for one response. A matching
/// If-None-Match is answered by the app-wide etag middleware, after the full
/// response is stored here.
export function cacheFor(ms: number): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		// Hono answers HEAD with GET handlers, but the Cache API only stores GETs
		if (c.req.raw.method !== 'GET') {
			await next()
			return
		}

		// match() answers a matching If-None-Match with a 304 itself
		let hit = await defaultCache.match(c.req.raw)
		if (hit) {
			let response = new Response(hit.body, hit)
			response.headers.set(CACHE_HIT_HEADER, 'HIT')
			return response
		}

		await next()

		// the Cache API rejects a put the response itself forbids
		if (c.res.status !== 200 || /\bno-store\b/.test(c.res.headers.get('Cache-Control') ?? '')) {
			return
		}
		// the ETag has to be on the response before it is stored, or match()
		// can never answer If-None-Match with a 304
		if (!c.res.headers.has('ETag')) {
			c.header('ETag', await bodyEtag(c.res.clone()))
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
