// vendored from https://github.com/koajs/cash/tree/515e5960d6a8844488d313e56c3d406c8e047127

import path from 'node:path'
import {Buffer} from 'node:buffer'
import type {ExtendableContext, Middleware, Next} from 'koa'
import {isPlainObject} from 'lodash-es'
import {Readable} from 'node:stream'
import stringify from 'safe-stable-stringify'
import * as Sentry from '@sentry/node'

// methods we cache
const defaultMethods = {HEAD: true, GET: true} as Record<string, boolean>

// text/plain extensions
// <https://github.com/jshttp/mime-db/blob/3145b8fd1a082730eb57540f68421b081909b651/db.json#L8373>
const TXT_EXTENSIONS = new Set(['txt', 'text', 'conf', 'def', 'list', 'log', 'in', 'ini'])

function isJson(body: unknown): boolean {
	if (body === null) {
		return true
	}
	if (body && typeof body === 'object') {
		return Array.isArray(body) || isPlainObject(body)
	}
	if (typeof body === 'string' || typeof body === 'number' || typeof body === 'boolean') {
		return true
	}
	return false
}

export function isStream(stream: unknown): stream is Readable {
	return (
		stream !== null &&
		typeof stream === 'object' &&
		'writable' in stream &&
		typeof stream.writable === 'boolean' &&
		'readable' in stream &&
		typeof stream.readable === 'boolean' &&
		(stream.writable || stream.readable) &&
		'pipe' in stream &&
		typeof stream.pipe === 'function'
	)
}

const CACHE_KEY: unique symbol = Symbol('koa-cache key')
const CACHE_INFO_KEY: unique symbol = Symbol('koa-cache info key')
const CACHE_FILL_KEY: unique symbol = Symbol('koa-cache fill key')
const CACHE_WAITED_KEY: unique symbol = Symbol('koa-cache waited key')

/// How a fill ended, for the requests waiting on it.
type FillOutcome =
	/** Its response is in the cache: serve it from there. */
	| {kind: 'stored'}
	/** It answered without caching (a 404, a 502, an empty 200): answer the same. */
	| {kind: 'replay'; status: number; headers: Record<string, string | string[]>; body: unknown}
	/** It threw: fail with the same error. */
	| {kind: 'error'; error: unknown}
	/** Its body can't be shared (a type the cache can't hold either): fetch for yourself. */
	| {kind: 'own'}

/// The headers a waiter takes from the response it waited on: those that
/// describe the content. Anything about the other request -- a cookie, an
/// etag the server computes per response, a tracing id -- stays with it.
const SHARED_HEADERS = [
	'cache-control',
	'content-language',
	'content-type',
	'expires',
	'last-modified',
	'location',
	'retry-after',
]

declare module 'koa' {
	interface ExtendableContext {
		/**
		 * This is how you enable a route to be cached. If you don't call await ctx.cached(),
		 * then this route will not be cached, nor will it attempt to serve the request from the cache.
		 *
		 * Notes:
		 * - Only `GET` and `HEAD` requests are cached.
		 * - Only 200 responses are cached. Don't set 304 status codes on these routes - this
		 *   middleware will handle it for you.
		 * - The underlying store should be able to handle Date objects as well as Buffer objects.
		 *   Otherwise, you may have to serialize/deserialize yourself.
		 *
		 * @param maxAge The max age passed to `get()`.
		 */
		cached(maxAge?: number): boolean
		/**
		 * This is a special method that you can use to clear the cache for a specific key
		 * @param key The cache key you want to invalidate
		 */
		evictCachedItem(key: string): void
		/**
		 * Override the cache TTL after fetching data. Call this after ctx.cached() returns false
		 * but before the response completes to change the TTL based on response content.
		 * @param maxAge The new max age in milliseconds
		 */
		setCacheTTL(maxAge: number): void
		/**
		 * cacheKey stores the key used to cache this response
		 */
		[CACHE_KEY]: string
		/**
		 * `cache` is set when you want to cache this response
		 */
		[CACHE_INFO_KEY]?: {maxAge?: number | undefined}
		/**
		 * Set when this request is the one filling the cache for its key; called
		 * once it is done, to let the requests waiting on it through
		 */
		[CACHE_FILL_KEY]?: (outcome: FillOutcome) => void
		/**
		 * Set when this request waited on another's fill. It never fills the key
		 * itself, so that requests arriving later don't queue behind its fetch
		 */
		[CACHE_WAITED_KEY]?: boolean
	}
}

export interface CacheObject {
	body: Buffer | string
	type: string | null
	lastModified: Date | null
	etag: string | null
	gzip?: Buffer
}

interface Options {
	/**
	 * Default max age (in milliseconds) for the cache if not set via `await ctx.cached(maxAge)`.
	 */
	maxAge?: number | undefined

	/**
	 * HTTP methods to cache. Defaults to `HEAD` and `GET`.
	 */
	methods?: Record<string, boolean> | undefined

	/**
	 * If a truthy value is passed, then X-Cached-Response header will be set as HIT when response
	 * is served from the cache.
	 * @default false
	 */
	setCachedHeader?: boolean | undefined

	/**
	 * A hashing function. By default, it caches based on the URL.
	 * @default
	 * ```
	 * function hash(ctx) {
	 *   return ctx.response.url; // same as ctx.url
	 * }
	 * ```
	 */
	hash?(ctx: ExtendableContext): string

	/**
	 * How long (in milliseconds) a request waits on another request that is
	 * already filling its key, before fetching for itself.
	 * @default 10_000
	 */
	fillWaitTimeout?: number | undefined

	/**
	 * Get a value from a store.
	 * @param key Cache key
	 * @param maxAge Max age (in milliseconds) for the cache
	 */
	get(key: string, maxAge?: number): CacheObject | undefined

	/**
	 * Set a value to a store.
	 * Note: `maxAge` is set by `.cash = { maxAge }`. If it's not set, then `maxAge` will be `0`,
	 * which you should then ignore.
	 * @param key Cache key
	 * @param value Cached value
	 * @param maxAge Max age (in milliseconds) for the cache
	 */
	set(key: string, value: CacheObject | undefined, maxAge?: number): void
}

export function cachable(options: Options): Middleware {
	options.setCachedHeader ??= false

	// eslint-disable-next-line @typescript-eslint/unbound-method
	const {get, set, hash = (ctx) => ctx.request.url, fillWaitTimeout = 10_000} = options

	const methods = {...defaultMethods, ...options.methods}

	// Keys some request is fetching right now, to how that fetch ends. A
	// request for one of these waits for that fetch instead of making its own,
	// so a burst of misses for one route costs one upstream fetch, not one each.
	// The waiters share its outcome: its cached response, or else its error or
	// its uncached response, so neither a failing upstream nor an uncacheable
	// route is hit again by every waiter at once. Only a fill that hangs past
	// `fillWaitTimeout`, or answers with a body that can't be shared, sends a
	// waiter upstream itself; it never fills the key, so requests arriving later
	// don't queue behind it.
	const filling = new Map<string, Promise<FillOutcome>>()

	// allow for manual cache clearing
	function evictCachedItem(key: string): void {
		set(key, undefined)
	}

	// allow overriding TTL after fetching
	function setCacheTTL(this: ExtendableContext, maxAge: number): void {
		if (this[CACHE_INFO_KEY]) {
			this[CACHE_INFO_KEY].maxAge = maxAge
		}
	}

	// ctx.cached(maxAge) => boolean
	function cached(this: ExtendableContext, maxAge: number | undefined): boolean {
		// uncacheable request method
		if (!methods[this.request.method]) return false

		const obj = get(this[CACHE_KEY], maxAge ?? options.maxAge ?? 0)
		const body = obj?.body
		if (!body) {
			// tell the upstream middleware to cache this response
			this[CACHE_INFO_KEY] = {maxAge}
			if (!this[CACHE_WAITED_KEY] && !filling.has(this[CACHE_KEY])) {
				let {promise, resolve} = Promise.withResolvers<FillOutcome>()
				let key = this[CACHE_KEY]
				filling.set(key, promise)
				this[CACHE_FILL_KEY] = (outcome) => {
					filling.delete(key)
					resolve(outcome)
				}
			}
			return false
		}

		// serve from cache
		if (obj.type) {
			this.response.type = obj.type
		}
		if (obj.lastModified) {
			this.response.lastModified = obj.lastModified
		}
		if (obj.etag) {
			this.response.etag = obj.etag
		}
		if (options.setCachedHeader) {
			this.response.set('X-Cached-Response', 'HIT')
		}

		if (this.request.fresh) {
			this.response.status = 304
			return true
		}

		this.response.body = obj.body

		return true
	}

	// the actual middleware
	async function cache(ctx: ExtendableContext, next: Next): Promise<void> {
		ctx.vary('Accept-Encoding')
		ctx.cached = cached.bind(ctx)
		ctx.evictCachedItem = evictCachedItem.bind(ctx)
		ctx.setCacheTTL = setCacheTTL.bind(ctx)

		if (methods[ctx.request.method]) {
			// One key for the whole request, so the fill it may wait on and the
			// fill it may start are the same.
			ctx[CACHE_KEY] = hash(ctx)

			// Another request is filling this key: wait for it, and take its outcome.
			let fill = filling.get(ctx[CACHE_KEY])
			if (fill) {
				ctx[CACHE_WAITED_KEY] = true
				let outcome = await waitFor(fill)
				if (outcome.kind === 'error') {
					throw outcome.error
				}
				if (outcome.kind === 'replay') {
					ctx.set(outcome.headers)
					ctx.status = outcome.status
					if (outcome.body !== null && outcome.body !== undefined) ctx.body = outcome.body
					return
				}
				// 'stored' goes on to serve from the cache; 'own' and a timeout
				// go on to fetch for themselves, as does 'stored' when the store
				// has already let the entry go (a maxAge of 0).
			}
		}

		let outcome: FillOutcome = {kind: 'own'}
		try {
			await next()
			outcome = (await store(ctx)) ? {kind: 'stored'} : await shareable(ctx)
		} catch (error) {
			outcome = {kind: 'error', error}
			throw error
		} finally {
			ctx[CACHE_FILL_KEY]?.(outcome)
		}
	}

	function waitFor(fill: Promise<FillOutcome>): Promise<FillOutcome | {kind: 'timeout'}> {
		return Sentry.startSpan({name: 'wait for cache fill', op: 'cache.wait'}, async (span) => {
			let timer: NodeJS.Timeout | undefined
			let timeout = new Promise<{kind: 'timeout'}>((resolve) => {
				timer = setTimeout(resolve, fillWaitTimeout, {kind: 'timeout'})
			})
			let outcome = await Promise.race([fill, timeout])
			clearTimeout(timer)
			span.setAttribute('cache.wait.outcome', outcome.kind)
			return outcome
		})
	}

	/// A response that wasn't cached, as waiters can answer with it. A stream
	/// can only be read once, so it is read into a buffer for everyone.
	async function shareable(ctx: ExtendableContext): Promise<FillOutcome> {
		let body: unknown = ctx.response.body
		if (isStream(body)) {
			body = Buffer.concat(await Array.fromAsync(body))
			ctx.response.body = body
		} else if (body !== null && body !== undefined && !isJson(body) && !Buffer.isBuffer(body)) {
			return {kind: 'own'}
		}

		let headers: Record<string, string | string[]> = {}
		for (let name of SHARED_HEADERS) {
			let value = ctx.response.headers[name]
			if (value !== undefined) {
				headers[name] = typeof value === 'number' ? String(value) : value
			}
		}
		return {kind: 'replay', status: ctx.response.status, headers, body}
	}

	/// Caches the response if it can; says whether it did.
	async function store(ctx: ExtendableContext): Promise<boolean> {
		// check for HTTP caching just in case
		if (!ctx[CACHE_INFO_KEY]) {
			if (ctx.request.fresh) {
				ctx.response.status = 304
			}
			return false
		}

		// cache the response

		// only cache GET/HEAD 200s
		if (ctx.response.status !== 200) {
			return false
		}
		if (!methods[ctx.request.method]) {
			return false
		}

		let body: unknown = ctx.response.body
		if (!body) {
			return false
		}

		let serializedBody: Buffer | string

		// stringify JSON bodies
		if (isStream(body)) {
			// buffer streams
			serializedBody = Buffer.concat(await Array.fromAsync(body))
			ctx.response.body = serializedBody
		} else if (isJson(body)) {
			serializedBody = stringify(body)
			ctx.response.body = serializedBody
		} else if (typeof body === 'string' || Buffer.isBuffer(body)) {
			serializedBody = body
		} else {
			// unsupported body type
			console.warn('Unsupported response body type:', typeof body)
			return false
		}

		// avoid any potential errors with middleware ordering
		if ((ctx.response.get('Content-Encoding') || 'identity') !== 'identity') {
			throw new Error('Place koa-cache below any compression middleware.')
		}

		const obj: CacheObject = {
			body: serializedBody,
			type: ctx.response.get('Content-Type') || null,
			lastModified: ctx.response.lastModified,
			etag: ctx.response.get('etag') || null,
		}

		// if the content-type was `text` or `text/plain` then don't cache
		// (since it's likely cache poisoning or the default Koa `text` being used)
		if (obj.type === 'text' || obj.type === 'text/plain') {
			const ext = path.extname(ctx.path)
			if (ext && !TXT_EXTENSIONS.has(ext.toLowerCase())) obj.type = null
		}

		if (ctx.request.fresh) {
			ctx.response.status = 304
		}

		if (!ctx[CACHE_KEY]) {
			throw new Error('cacheKey is undefined when trying to set cache')
		}

		set(ctx[CACHE_KEY], obj, ctx[CACHE_INFO_KEY].maxAge ?? options.maxAge ?? 0)
		return true
	}

	return cache
}
