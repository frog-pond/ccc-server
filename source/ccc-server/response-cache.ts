import type {ExtendableContext} from 'koa'
import type QuickLRU from 'quick-lru'
import * as Sentry from '@sentry/node'
import {cachable, type CacheObject} from '../ccc-koa/cache.ts'
import {ONE_DAY} from '../ccc-lib/constants.ts'
import {STORED_HEADERS} from '../ccc-lib/stored-headers.ts'
import {parsePercent, percentChance, recordFlagInSentry} from '../ccc-lib/feature-flags.ts'

/// The route a request matched, as the router's template (`/v1/food/named/:name`),
/// so a metric gets one series per route rather than one per URL.
function routeOf(ctx: ExtendableContext): string {
	let route: unknown = (ctx as {_matchedRoute?: unknown})._matchedRoute
	return typeof route === 'string' ? route : 'unknown'
}

export function responseCache(
	cache: QuickLRU<string, CacheObject | undefined>,
	{institution}: {institution: string},
) {
	setInterval(() => {
		Sentry.metrics.gauge('cache.entries', cache.size, {attributes: {institution}})
	}, 60_000).unref()
	return cachable({
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
			Sentry.metrics.count('cache.burst', 1, {attributes: {institution, shared}})
		},
		onLookup: (ctx, hit) => {
			Sentry.metrics.count('cache.lookup', 1, {
				attributes: {institution, result: hit ? 'hit' : 'miss', route: routeOf(ctx)},
			})
		},
		onFillEnd: (ctx, outcome, waiters) => {
			let attributes = {institution, outcome, route: routeOf(ctx)}
			Sentry.metrics.count('cache.fill', 1, {attributes})
			Sentry.metrics.distribution('cache.fill.waiters', waiters, {attributes})
		},
		// A list a route fetched, counted once per fetch: a scraper whose upstream
		// changes shape tends not to throw but to read nothing, so it shows here
		// as a route whose count drops to zero and stays there.
		onStore: (ctx, body) => {
			if (!Array.isArray(body)) return
			Sentry.metrics.gauge('route.items', body.length, {
				attributes: {institution, route: routeOf(ctx)},
			})
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
	})
}
