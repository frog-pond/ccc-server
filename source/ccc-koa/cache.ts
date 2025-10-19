// vendored from https://github.com/koajs/cash/tree/515e5960d6a8844488d313e56c3d406c8e047127

import path from 'node:path'
import {Buffer} from 'node:buffer'
import type {ExtendableContext, Middleware, Next} from 'koa'
import {isPlainObject} from 'lodash-es'
import {Readable} from 'node:stream'
import stringify from 'safe-stable-stringify'

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
		cached(maxAge?: number): Promise<boolean>
		/**
		 * This is a special method that you can use to clear the cache for a specific key
		 * @param key The cache key you want to invalidate
		 */
		evictCachedItem(key: string): Promise<void>
		/**
		 * cacheKey stores the key used to cache this response
		 */
		[CACHE_KEY]: string
		/**
		 * `cache` is set when you want to cache this response
		 */
		[CACHE_INFO_KEY]?: {maxAge?: number | undefined}
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
	 * Get a value from a store. Must return a Promise, which returns the cache's value, if any.
	 * @param key Cache key
	 * @param maxAge Max age (in milliseconds) for the cache
	 */
	get(key: string, maxAge?: number): Promise<CacheObject | undefined>

	/**
	 * Set a value to a store. Must return a Promise.
	 * Note: `maxAge` is set by `.cash = { maxAge }`. If it's not set, then `maxAge` will be `0`,
	 * which you should then ignore.
	 * @param key Cache key
	 * @param value Cached value
	 * @param maxAge Max age (in milliseconds) for the cache
	 */
	set(key: string, value: CacheObject | undefined, maxAge?: number): Promise<void>
}

export function cachable(options: Options): Middleware {
	options.setCachedHeader ??= false

	// eslint-disable-next-line @typescript-eslint/unbound-method
	const {get, set, hash = (ctx) => ctx.request.url} = options

	const methods = {...defaultMethods, ...options.methods}

	// allow for manual cache clearing
	async function evictCachedItem(key: string): Promise<void> {
		await set(key, undefined)
	}

	// ctx.cached(maxAge) => boolean
	async function cached(this: ExtendableContext, maxAge: number | undefined): Promise<boolean> {
		// uncacheable request method
		if (!methods[this.request.method]) return false

		this[CACHE_KEY] = hash(this)
		const obj = await get(this[CACHE_KEY], maxAge ?? options.maxAge ?? 0)
		const body = obj?.body
		if (!body) {
			// tell the upstream middleware to cache this response
			this[CACHE_INFO_KEY] = {maxAge}
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

		await next()

		// check for HTTP caching just in case
		if (!ctx[CACHE_INFO_KEY]) {
			if (ctx.request.fresh) {
				ctx.response.status = 304
			}
			return
		}

		// cache the response

		// only cache GET/HEAD 200s
		if (ctx.response.status !== 200) {
			return
		}
		if (!methods[ctx.request.method]) {
			return
		}

		let body: unknown = ctx.response.body
		if (!body) {
			return
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
			return
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

		await set(ctx[CACHE_KEY], obj, ctx[CACHE_INFO_KEY].maxAge ?? options.maxAge ?? 0)
	}

	return cache
}
