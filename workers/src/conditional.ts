import {AsyncLocalStorage} from 'node:async_hooks'

/// Conditional requests for the sources (https://rachelbythebay.com/w/2022/03/07/get/):
/// while a source loads, every GET it makes through `upstream` sends the
/// validators its last answer from that address came with, and a 304 is
/// answered with the body kept from then. A source loads the same way either
/// way; the site just does not send what has not changed. The load also
/// notes the longest `Retry-After` a 429 or 503 asked for.

/// An answer kept for its validators: what a 304 stands for.
export type KeptResponse = {
	etag: string | null
	lastModified: string | null
	headers: [string, string][]
	body: string
}

export type Conditional = {
	/// the answers the last load kept, by `addressKey`
	kept: ReadonlyMap<string, KeptResponse>
	/// the answers this load got (or re-used), to keep for the next one
	used: Map<string, KeptResponse>
	/// the longest wait a 429 or 503 asked for, in milliseconds
	retryAfter: number
}

export const conditional = new AsyncLocalStorage<Conditional>()

/// A body bigger than this is not kept, and its address is asked for in full.
/// Bodies are kept compressed, and a SQLite row holds at most 2 MB: a café page
/// or Carleton's calendar page is 1.5 to 3.5 MB of HTML, a tenth of that gzipped.
const MAX_KEPT = 16 * 1024 * 1024
/// Nor is one that is bigger than this compressed.
export const MAX_KEPT_COMPRESSED = 1024 * 1024

/// A body as it is kept.
export async function gzip(text: string): Promise<ArrayBuffer> {
	let stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
	return new Response(stream).arrayBuffer()
}

/// A kept body as it was.
export async function gunzip(data: ArrayBuffer): Promise<string> {
	let stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
	return new Response(stream).text()
}

/// The longest `Retry-After` honored, so a misread or hostile header cannot
/// stop a source for good.
const MAX_RETRY_AFTER = 24 * 60 * 60 * 1000

/// An address as stored: a digest, so a key in a query is never written down.
export async function addressKey(url: string): Promise<string> {
	let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/// A `Retry-After` in milliseconds from `now`: seconds, or an HTTP date.
export function retryAfterMs(header: string | null, now: number): number {
	if (header === null) return 0
	let value = header.trim()
	let ms = /^\d+$/u.test(value) ? Number(value) * 1000 : Date.parse(value) - now
	return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_AFTER) : 0
}

/// A GET made while a source loads: sent with the kept validators for its
/// address, answered from the kept body on a 304, and kept for next time
/// when it carries validators.
export async function conditionalFetch(
	context: Conditional,
	url: string,
	init: RequestInit & {headers: Headers},
	send: (headers: Headers) => Promise<Response>,
	now: number,
): Promise<Response> {
	let key = await addressKey(url)
	let kept = context.kept.get(key)
	let headers = new Headers(init.headers)
	if (kept?.etag) headers.set('If-None-Match', kept.etag)
	if (kept?.lastModified) headers.set('If-Modified-Since', kept.lastModified)

	let response = await send(headers)
	if (response.status === 429 || response.status === 503) {
		let wait = retryAfterMs(response.headers.get('Retry-After'), now)
		context.retryAfter = Math.max(context.retryAfter, wait)
	}
	if (response.status === 304 && kept) {
		context.used.set(key, kept)
		return new Response(kept.body, {status: 200, headers: kept.headers})
	}
	let etag = response.headers.get('ETag')
	let lastModified = response.headers.get('Last-Modified')
	if (response.status === 200 && (etag || lastModified)) {
		let body = await response.clone().text()
		if (body.length <= MAX_KEPT) {
			let headers = [...response.headers].filter(([name]) => name !== 'set-cookie')
			context.used.set(key, {etag, lastModified, headers, body})
		}
	}
	return response
}
