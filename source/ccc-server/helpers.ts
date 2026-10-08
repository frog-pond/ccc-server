import type Router from '@koa/router'
import * as Sentry from '@sentry/node'
import type {Context, ContextState, RouterState} from './context.ts'

export interface CacheAdmin {
	keys(): IterableIterator<string>
	expiresIn(key: string): number | undefined
	/** Boolean stores evict one entry; grouped stores report the number of listed keys evicted. */
	delete(key: string): boolean | number
	clear(): void
	readonly size: number
}

/// Register helpers on an institution router using its own response cache.
export function setupHelpers(
	api: Router<RouterState, ContextState>,
	cache: CacheAdmin,
	{
		institution,
		additionalCache,
	}: {
		institution: string
		additionalCache?: (ctx: Pick<Context, 'app' | 'path'>) => CacheAdmin
	},
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
		for (const store of additionalCache ? [cache, additionalCache(ctx)] : [cache]) {
			for (const key of store.keys()) {
				result.set(key, Math.floor((store.expiresIn(key) ?? 0) / 1000).toFixed(0))
			}
		}
		ctx.body = Object.fromEntries(result.entries())
	})

	api.delete('/_cache', (ctx) => {
		let requestedKeys = ctx.URL.searchParams.getAll('key')
		let found = 0
		let stores = additionalCache ? [cache, additionalCache(ctx)] : [cache]
		if (requestedKeys.length) {
			for (const key of requestedKeys) {
				for (const store of stores) {
					found += Number(store.delete(key))
				}
			}
		} else {
			for (const store of stores) {
				found += store.size
				store.clear()
			}
		}
		ctx.response.set('X-Cache-Deleted', found.toFixed(0))
		Sentry.metrics.count('cache.evicted', found, {
			attributes: {institution, scope: requestedKeys.length ? 'keys' : 'all'},
		})
		ctx.status = 204
	})
}
