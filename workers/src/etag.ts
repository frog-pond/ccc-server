/// Every successful response carries an ETag, the digest of its body, and a
/// request that already holds that body (`If-None-Match`) is answered with a
/// 304 and no body. A client re-checks when its copy's max-age runs out and
/// downloads again only when the body has changed.

async function tagOf(body: ArrayBuffer): Promise<string> {
	let digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body))
	let base64 = btoa(String.fromCharCode(...digest.subarray(0, 18)))
	return `"${base64.replaceAll('+', '-').replaceAll('/', '_')}"`
}

/// Whether `If-None-Match` names the tag: `*`, or any tag in the list, compared
/// weakly (a `W/` prefix is ignored), as RFC 9110 has it for this header.
export function matches(ifNoneMatch: string | null, tag: string): boolean {
	if (ifNoneMatch === null) return false
	if (ifNoneMatch.trim() === '*') return true
	let strip = (value: string) => value.trim().replace(/^W\//u, '')
	return ifNoneMatch.split(',').some((candidate) => strip(candidate) === strip(tag))
}

export async function withETag(request: Request, response: Response): Promise<Response> {
	if (request.method !== 'GET' || response.status !== 200 || response.headers.has('ETag')) {
		return response
	}
	let body = await response.arrayBuffer()
	let tag = await tagOf(body)
	let headers = new Headers(response.headers)
	headers.set('ETag', tag)
	if (matches(request.headers.get('If-None-Match'), tag)) {
		// a 304 repeats the headers that say how long to keep the copy
		for (let name of ['Content-Type', 'Content-Length']) headers.delete(name)
		return new Response(null, {status: 304, headers})
	}
	return new Response(body, {status: response.status, statusText: response.statusText, headers})
}
