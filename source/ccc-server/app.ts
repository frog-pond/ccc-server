import etag from '@koa/etag'
import compress from 'koa-compress'
import {withBodyParsers} from '@koa/body-parsers'
import Router from '@koa/router'
import Koa from 'koa'
import {z} from 'zod'
import * as Sentry from '@sentry/node'
import type {ContextState, RouterState} from './context.ts'
import {accessLog} from '../ccc-koa/access-log.ts'
import {BEHIND_NGINX} from '../ccc-koa/behind-proxy.ts'
import {ignoreClientHangUps} from '../ccc-koa/client-abort.ts'
import {conditionalGet} from '../ccc-koa/conditional-get.ts'
import {ctxCacheControl} from '../ccc-koa/ctx-cache-control.ts'
import {cachable, type CacheObject} from '../ccc-koa/cache.ts'
import QuickLRU from 'quick-lru'
import {ONE_DAY} from '../ccc-lib/constants.ts'
import {STORED_HEADERS} from '../ccc-lib/stored-headers.ts'
import {parsePercent, percentChance, recordFlagInSentry} from '../ccc-lib/feature-flags.ts'

export const InstitutionSchema = z.enum(['stolaf-college', 'carleton-college'])

/// The route a request matched, as the router's template (`/v1/food/named/:name`),
/// so a metric gets one series per route rather than one per URL.
function routeOf(ctx: Koa.ExtendableContext): string {
	let route: unknown = (ctx as {_matchedRoute?: unknown})._matchedRoute
	return typeof route === 'string' ? route : 'unknown'
}

export async function createApp(institution: z.infer<typeof InstitutionSchema>) {
	const app = new Koa(BEHIND_NGINX)
	ignoreClientHangUps(app)

	//
	// set up the routes
	//
	const router = new Router<RouterState, ContextState>()
	const {v1} = await (institution === 'stolaf-college'
		? import('../ccci-stolaf-college/index.ts')
		: import('../ccci-carleton-college/index.ts'))
	router.use(v1.routes())

	router.get('/', (ctx) => {
		ctx.body = 'Hello world!'
	})

	router.get('/ping', (ctx) => {
		ctx.body = 'pong'
	})

	//
	// attach middleware
	//

	// logging
	app.use(accessLog())

	// automatically compress responses (TODO: delegate to nginx?)
	app.use(compress())

	// etag works together with conditional-get
	app.use(conditionalGet())
	app.use(etag())

	// support adding cache-control headers
	ctxCacheControl(app)

	// parse request bodies
	withBodyParsers(app)

	// add cached response support at the Koa level
	// (individual route handlers can use ctx.cache to set caching parameters)
	let cache = new QuickLRU<string, CacheObject | undefined>({maxSize: 10_000, maxAge: ONE_DAY})
	setInterval(() => {
		Sentry.metrics.gauge('cache.entries', cache.size)
	}, 60_000).unref()
	app.use(
		cachable({
			statusName: 'ccc-server',
			storedHeaders: STORED_HEADERS,
			expiresIn: (key) => cache.expiresIn(key),
			// for this percentage of bursts of concurrent misses for a key, share
			// one upstream fetch among the burst
			shareFetch: percentChance(
				parsePercent('CACHE_FILL_DEDUPE_PERCENT', process.env['CACHE_FILL_DEDUPE_PERCENT']),
			),
			onBurst: (_ctx, shared) => {
				recordFlagInSentry('cache-fill-dedupe', shared)
				Sentry.metrics.count('cache.burst', 1, {attributes: {shared}})
			},
			onLookup: (ctx, hit) => {
				Sentry.metrics.count('cache.lookup', 1, {
					attributes: {result: hit ? 'hit' : 'miss', route: routeOf(ctx)},
				})
			},
			onFillEnd: (ctx, outcome, waiters) => {
				let attributes = {outcome, route: routeOf(ctx)}
				Sentry.metrics.count('cache.fill', 1, {attributes})
				Sentry.metrics.distribution('cache.fill.waiters', waiters, {attributes})
			},
			// A list a route fetched, counted once per fetch: a scraper whose upstream
			// changes shape tends not to throw but to read nothing, so it shows here
			// as a route whose count drops to zero and stays there.
			onStore: (ctx, body) => {
				if (!Array.isArray(body)) return
				Sentry.metrics.gauge('route.items', body.length, {attributes: {route: routeOf(ctx)}})
			},
			get(key) {
				return cache.get(key)
			},
			set(key, value, maxAge = ONE_DAY) {
				if (value === undefined) {
					cache.delete(key)
					return
				}
				cache.set(key, value, {maxAge})
			},
		}),
	)

	router.get('/_cache', (ctx) => {
		if (ctx.cached(10000)) return
		let result = new Map()
		for (const key of cache.keys()) {
			result.set(key, Math.floor((cache.expiresIn(key) ?? 0) / 1000).toFixed(0))
		}
		ctx.body = Object.fromEntries(result.entries())
	})

	router.delete('/_cache', (ctx) => {
		let keys = ctx.URL.searchParams.getAll('key')
		if (keys.length) {
			let found = 0
			for (let key of keys) {
				let didDelete = cache.delete(key)
				if (didDelete) found++
			}
			ctx.response.set('X-Cache-Deleted', found.toFixed(0))
			Sentry.metrics.count('cache.evicted', found, {attributes: {scope: 'keys'}})
		} else {
			let size = cache.size
			cache.clear()
			ctx.response.set('X-Cache-Deleted', size.toFixed(0))
			Sentry.metrics.count('cache.evicted', size, {attributes: {scope: 'all'}})
		}
		ctx.status = 204
	})

	// hook in the router
	app.use(router.routes())
	app.use(router.allowedMethods())

	return app
}
