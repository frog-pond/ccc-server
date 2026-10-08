import type Router from '@koa/router'
import type QuickLRU from 'quick-lru'
import * as Sentry from '@sentry/node'
import type {CacheObject} from '../ccc-koa/cache.ts'
import type {ContextState, RouterState} from './context.ts'

export const HELPER_CACHE = Symbol('server helper cache')

declare module 'koa' {
	interface ExtendableContext {
		[HELPER_CACHE]: QuickLRU<string, CacheObject | undefined>
	}
}

/// Register helpers on the institution router so they inherit its mount path.
/// The app supplies its response cache; the matched mount scopes administration.
export function setupHelpers(api: Router<RouterState, ContextState>) {
	api.get('/', (ctx) => {
		ctx.body = 'Hello world!'
	})

	api.get('/ping', (ctx) => {
		ctx.body = 'pong'
	})

	api.get('/_cache', (ctx) => {
		if (ctx.cached(10000)) return
		const cache = ctx[HELPER_CACHE]
		const prefix = ctx.path.replace(/\/_cache\/?$/i, '').toLowerCase()
		let result = new Map()
		for (const key of cache.keys()) {
			if (!key.toLowerCase().startsWith(`${prefix}/`)) continue
			result.set(key, Math.floor((cache.expiresIn(key) ?? 0) / 1000).toFixed(0))
		}
		ctx.body = Object.fromEntries(result.entries())
	})

	api.delete('/_cache', (ctx) => {
		const cache = ctx[HELPER_CACHE]
		const prefix = ctx.path.replace(/\/_cache\/?$/i, '').toLowerCase()
		let requestedKeys = ctx.URL.searchParams.getAll('key')
		let keys = requestedKeys.length ? requestedKeys : [...cache.keys()]
		let found = 0
		for (let key of keys) {
			if (key.toLowerCase().startsWith(`${prefix}/`) && cache.delete(key)) found++
		}
		ctx.response.set('X-Cache-Deleted', found.toFixed(0))
		Sentry.metrics.count('cache.evicted', found, {
			attributes: {scope: requestedKeys.length ? 'keys' : 'all'},
		})
		ctx.status = 204
	})
}
