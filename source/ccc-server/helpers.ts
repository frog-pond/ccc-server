import type Router from '@koa/router'
import * as Sentry from '@sentry/node'
import type {Context, ContextState, RouterState} from './context.ts'
import {listInputs, type DeclaredHandler} from './route-inputs.ts'

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

	/// Clears the whole cache, or only the entries named by `?key=`.
	function clearCache(ctx: Context) {
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
	}
	clearCache.inputs = {key: {}}
	api.delete('/_cache', clearCache)
}

/// The sitemap: every route on an institution router, one entry per layer, so
/// a path answering several methods appears once per method. HEAD is left
/// out, since the router answers it for every GET without being asked.
export function routeListing(api: Router<RouterState, ContextState>) {
	return (ctx: Context) => {
		const mountPrefix = ctx.path.replace(/\/v1\/routes\/?$/i, '')
		const leadingVersionRegex = /^\/v[0-9]+(?:\.[0-9]+)*\//
		ctx.body = api.stack
			.filter((layer) => layer.methods.length > 0)
			.map((layer) => ({
				path: `${mountPrefix}${layer.path.toString()}`,
				displayName: layer.path.toString().replace(leadingVersionRegex, ''),
				methods: layer.methods.filter((method) => method !== 'HEAD'),
				params: layer.paramNames.map((param) => param.name),
				inputs: listInputs(
					layer.paramNames.map((param) => param.name),
					// the route's own handler is the last function on the layer
					(layer.stack.at(-1) as DeclaredHandler | undefined)?.inputs,
				),
			}))
			.toSorted(
				(a, b) => a.path.localeCompare(b.path) || a.methods.join().localeCompare(b.methods.join()),
			)
	}
}
