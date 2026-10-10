import {CLIENT_MAX_AGE, ERROR_MAX_AGE} from './lifetimes.ts'

/// `?before=` pages back through a feed's kept history (`src/archive.ts`):
/// an ISO 8601 time, and the answer is the items from before it, with a
/// `Link` to the page after when it is full.

const ISO_TIME =
	/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/u

const json = (body: unknown, status: number, maxAge: number, headers: HeadersInit = {}) =>
	Response.json(body, {
		status,
		headers: {...headers, 'Cache-Control': `public, max-age=${maxAge.toFixed(0)}`},
	})

/// The request's `?before=`, in milliseconds; undefined when it has none, or a
/// 400 when it is not a time.
export function parseBefore(url: URL): number | undefined | Response {
	let before = url.searchParams.get('before')
	if (before === null) return undefined
	let at = ISO_TIME.test(before) ? Date.parse(before) : NaN
	if (!Number.isFinite(at)) {
		return json({message: 'before must be an ISO 8601 date or time'}, 400, ERROR_MAX_AGE)
	}
	return at
}

/// One page of history. `oldest` is when the page's earliest item happened,
/// where the next page picks up; a page shorter than `limit` is the last.
export function historyPage(
	url: URL,
	body: unknown,
	count: number,
	limit: number,
	oldest: number | undefined,
): Response {
	let headers: Record<string, string> = {}
	if (count === limit && oldest !== undefined) {
		let next = new URLSearchParams(url.searchParams)
		next.set('before', new Date(oldest).toISOString())
		headers['Link'] = `<${url.pathname}?${next.toString()}>; rel="next"`
	}
	return json(body, 200, CLIENT_MAX_AGE, headers)
}
