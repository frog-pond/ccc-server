/// What the worker says it is to the sites it reads.
export const USER_AGENT = 'ccc-server/2.0'

/// A request to an upstream site, saying who is asking. A redirect is never
/// followed: each caller checks the host it fetches, and a redirect could
/// leave it.
export function upstream(url: string, init: RequestInit = {}): Promise<Response> {
	let headers = new Headers(init.headers)
	headers.set('User-Agent', USER_AGENT)
	return fetch(url, {...init, headers, redirect: 'manual'})
}
