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

/// A stream's whole body, whether it yields bytes (Buffers or Uint8Arrays) or
/// strings.
async function readAll(stream: Readable): Promise<Buffer> {
	let chunks = await Array.fromAsync(stream, (chunk: unknown) => {
		if (typeof chunk === 'string') return Buffer.from(chunk)
		if (chunk instanceof Uint8Array) return chunk
		throw new TypeError(`cannot cache a stream chunk of type ${typeof chunk}`)
	})
	return Buffer.concat(chunks)
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
const CACHE_BYPASS_KEY: unique symbol = Symbol('koa-cache bypass key')

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

/// A fill in progress: how it will end, and how to end it.
interface Fill {
	outcome: Promise<FillOutcome>
	settle(outcome: FillOutcome): void
	/** How many requests have waited on it */
	waiters: number
}

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
		[CACHE_FILL_KEY]?: Fill | undefined
		/**
		 * Set when this request waited on another's fill. It never fills the key
		 * itself, so that requests arriving later don't queue behind its fetch
		 */
		[CACHE_WAITED_KEY]?: boolean
		/**
		 * Set when this request was the first to miss its key in a burst that
		 * doesn't share one fetch; cleared once it is done
		 */
		[CACHE_BYPASS_KEY]?: object | undefined
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
	 * The name this cache gives itself in the `Cache-Status` header (RFC 9211).
	 * If it isn't set, responses don't carry the header.
	 */
	statusName?: string | undefined

	/**
	 * How long (in milliseconds) a key has left before it expires, for the
	 * `ttl` in `Cache-Status`. If it isn't set, or says `undefined`, the header
	 * leaves `ttl` out.
	 */
	expiresIn?(key: string): number | undefined

	/**
	 * A hashing function. By default, it caches based on the URL. It runs once,
	 * as the request comes in -- before the router, so `ctx.params` isn't set.
	 * @default
	 * ```
	 * function hash(ctx) {
	 *   return ctx.response.url; // same as ctx.url
	 * }
	 * ```
	 */
	hash?(ctx: ExtendableContext): string

	/**
	 * Whether a burst of concurrent misses for a key shares one fetch, asked
	 * of the first request in the burst to miss. If not, every request in the
	 * burst fetches for itself, as every request did before fetches were shared.
	 * @default every burst shares
	 */
	shareFetch?(ctx: ExtendableContext): boolean

	/**
	 * Told, for each request in a burst of misses, whether the burst shares one
	 * fetch: for the first to miss, the requests that wait on it, and the
	 * requests that miss while a burst that doesn't share is under way.
	 * Requests served from the cache are not in a burst, and aren't told.
	 */
	onBurst?(ctx: ExtendableContext, shared: boolean): void

	/**
	 * Told, each time a route asks `ctx.cached()` (for a method the cache
	 * holds), whether it found a copy to serve.
	 */
	onLookup?(ctx: ExtendableContext, hit: boolean): void

	/**
	 * Told, once for each fill, how it ended and how many requests waited on
	 * it, with the request that started it.
	 */
	onFillEnd?(ctx: ExtendableContext, outcome: FillOutcome['kind'], waiters: number): void

	/**
	 * Told, each time a response is stored, the body as the route set it,
	 * before it is serialized: once per fetch from upstream, since requests
	 * served from the cache, or by waiting on another's fill, store nothing.
	 */
	onStore?(ctx: ExtendableContext, body: unknown): void

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
	/* eslint-disable @typescript-eslint/unbound-method */
	const {
		get,
		set,
		statusName,
		expiresIn = () => undefined,
		hash = (ctx) => ctx.request.url,
		shareFetch = () => true,
		onBurst = () => undefined,
		onLookup = () => undefined,
		onFillEnd = () => undefined,
		onStore = () => undefined,
	} = options
	/* eslint-enable @typescript-eslint/unbound-method */

	const methods = {...defaultMethods, ...options.methods}

	/// Says how the cache handled this request, in a `Cache-Status` header
	/// (RFC 9211) made of `params`.
	function setCacheStatus(ctx: ExtendableContext, params: string[]): void {
		if (statusName === undefined) return
		ctx.response.set('Cache-Status', [statusName, ...params].join('; '))
	}

	// The reporting hooks only watch: one that throws mustn't fail a request or
	// change how a fill ends. Each is logged the first
	// time it throws, so a broken hook shows without flooding the log.
	const brokenHooks = new Set<string>()
	function report(name: string, hook: () => void): void {
		try {
			hook()
		} catch (error) {
			if (brokenHooks.has(name)) return
			brokenHooks.add(name)
			console.error(`cache ${name} hook threw (logged only the first time)`, error)
		}
	}

	// Keys some request is fetching right now, to how that fetch ends. A
	// request for one of these waits for that fetch instead of making its own,
	// so a burst of misses for one route costs one upstream fetch, not one each.
	// The waiters share its outcome: its cached response, or else its error or
	// its uncached response, so neither a failing upstream nor an uncacheable
	// route is hit again by every waiter at once. Any request that stores the
	// key ends its fill, so no one waits past a fresh copy.
	//
	// Whether a burst shares one fetch is decided once, by its first miss, and
	// holds for every request in it. One that doesn't share leaves a marker in
	// `bypassing` instead of a fill, so the rest of the burst knows to fetch for
	// itself too, until that first request is done or the key is stored.
	//
	// Waiters wait as long as the fill takes. A fill always ends, since its
	// request settles it when done, and an upstream that stalls is cut off by
	// the HTTP client's own timeouts -- as each waiter would be, fetching alone.
	const filling = new Map<string, Fill>()

	function startFill(ctx: ExtendableContext): Fill {
		let key = ctx[CACHE_KEY]
		let {promise, resolve} = Promise.withResolvers<FillOutcome>()
		// a request that stores its response settles its fill there, then again when done
		let settled = false
		let fill: Fill = {
			outcome: promise,
			waiters: 0,
			settle(outcome) {
				if (filling.get(key) === fill) filling.delete(key)
				resolve(outcome)
				if (settled) return
				settled = true
				report('onFillEnd', () => {
					onFillEnd(ctx, outcome.kind, fill.waiters)
				})
			},
		}
		filling.set(key, fill)
		return fill
	}

	// Keys whose current burst of misses doesn't share one fetch, to the marker
	// its first request left.
	const bypassing = new Map<string, object>()

	/// A request has missed its key: it joins the burst under way, or starts one.
	function joinBurst(ctx: ExtendableContext): void {
		// a waiter joined its burst when it began to wait
		if (ctx[CACHE_WAITED_KEY]) return

		let key = ctx[CACHE_KEY]
		if (filling.has(key)) {
			// a fill began after this request came in, too late to wait on
			onBurst(ctx, true)
			return
		}
		if (bypassing.has(key)) {
			onBurst(ctx, false)
			return
		}

		let shared = shareFetch(ctx)
		onBurst(ctx, shared)
		if (shared) {
			ctx[CACHE_FILL_KEY] = startFill(ctx)
		} else {
			let marker = {}
			bypassing.set(key, marker)
			ctx[CACHE_BYPASS_KEY] = marker
		}
	}

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
		report('onLookup', () => {
			onLookup(this, Boolean(body))
		})
		if (!body) {
			// tell the upstream middleware to cache this response
			this[CACHE_INFO_KEY] = {maxAge}
			joinBurst(this)
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
		let ttl = expiresIn(this[CACHE_KEY])
		setCacheStatus(this, ttl === undefined ? ['hit'] : ['hit', `ttl=${Math.floor(ttl / 1000)}`])

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
				onBurst(ctx, true)
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
				// 'stored' goes on to serve from the cache; 'own' goes on to fetch
				// for itself, as does 'stored' when the store has already let the
				// entry go (a maxAge of 0).
			}
		}

		let outcome: FillOutcome = {kind: 'own'}
		try {
			await next()
			let stored = await store(ctx)
			if (ctx[CACHE_INFO_KEY]) {
				setCacheStatus(ctx, stored ? ['fwd=uri-miss', 'stored'] : ['fwd=uri-miss'])
			}
			if (stored) {
				outcome = {kind: 'stored'}
			} else if (ctx[CACHE_FILL_KEY]) {
				outcome = await shareable(ctx)
			}
		} catch (error) {
			outcome = {kind: 'error', error}
			throw error
		} finally {
			ctx[CACHE_FILL_KEY]?.settle(outcome)
			let marker = ctx[CACHE_BYPASS_KEY]
			if (marker && bypassing.get(ctx[CACHE_KEY]) === marker) {
				bypassing.delete(ctx[CACHE_KEY])
			}
		}
	}

	/// Waits on `fill` until it ends.
	function waitFor(fill: Fill): Promise<FillOutcome> {
		fill.waiters++
		return Sentry.startSpan({name: 'wait for cache fill', op: 'cache.wait'}, async (span) => {
			let outcome = await fill.outcome
			span.setAttribute('cache.wait.outcome', outcome.kind)
			return outcome
		})
	}

	/// A response that wasn't cached, as waiters can answer with it. A stream
	/// can only be read once, so it is read into a buffer for everyone.
	async function shareable(ctx: ExtendableContext): Promise<FillOutcome> {
		let body: unknown = ctx.response.body
		if (isStream(body)) {
			body = await readAll(body)
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
		let setBody = body

		let serializedBody: Buffer | string

		// stringify JSON bodies
		if (isStream(body)) {
			// buffer streams
			serializedBody = await readAll(body)
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
		report('onStore', () => {
			onStore(ctx, setBody)
		})
		// Whoever is filling the key, its waiters can have this copy now.
		filling.get(ctx[CACHE_KEY])?.settle({kind: 'stored'})
		// and a burst that doesn't share is over: later requests hit the cache
		bypassing.delete(ctx[CACHE_KEY])
		return true
	}

	return cache
}
