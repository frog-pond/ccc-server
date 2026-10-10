import {clock} from './clock.ts'
import {conditional, conditionalFetch} from './conditional.ts'

/// What the worker says it is to the sites it reads.
export const USER_AGENT = 'ccc-server/2.0'

/// A request to an upstream site, saying who is asking. A redirect is never
/// followed: each caller checks the host it fetches, and a redirect could
/// leave it. A GET made while a source loads is conditional
/// (`src/conditional.ts`).
export function upstream(url: string, init: RequestInit = {}): Promise<Response> {
	let headers = new Headers(init.headers)
	headers.set('User-Agent', USER_AGENT)
	let send = (sent: Headers) => fetch(url, {...init, headers: sent, redirect: 'manual'})
	let context = conditional.getStore()
	if (!context || (init.method ?? 'GET').toUpperCase() !== 'GET') return send(headers)
	return conditionalFetch(context, url, {...init, headers}, send, clock.now())
}
