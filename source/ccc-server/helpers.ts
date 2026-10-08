import type Router from '@koa/router'
import * as Sentry from '@sentry/node'
import type {ContextState, RouterState} from './context.ts'

export interface CacheAdmin {
	keys(): IterableIterator<string>
	expiresIn(key: string): number | undefined
	delete(key: string): boolean
	clear(): void
	readonly size: number
}

/// Register helpers on an institution router using its own response cache.
export function setupHelpers(
	api: Router<RouterState, ContextState>,
	cache: CacheAdmin,
	{institution}: {institution: string},
) {
	api.get('/', (ctx) => {
		ctx.body = 'Hello world!'
	})

	api.get('/ping', (ctx) => {
		ctx.body = 'pong'
	})

	api.get('/_cache', (ctx) => {
		if (ctx.cached(10000)) return
		let result = new Map()
		for (const key of cache.keys()) {
			result.set(key, Math.floor((cache.expiresIn(key) ?? 0) / 1000).toFixed(0))
		}
		ctx.body = Object.fromEntries(result.entries())
	})

	api.delete('/_cache', (ctx) => {
		let requestedKeys = ctx.URL.searchParams.getAll('key')
		let found = 0
		if (requestedKeys.length) {
			for (const key of requestedKeys) {
				if (cache.delete(key)) found++
			}
		} else {
			found = cache.size
			cache.clear()
		}
		ctx.response.set('X-Cache-Deleted', found.toFixed(0))
		Sentry.metrics.count('cache.evicted', found, {
			attributes: {institution, scope: requestedKeys.length ? 'keys' : 'all'},
		})
		ctx.status = 204
	})
}
