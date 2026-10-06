import * as Sentry from '@sentry/node'
import ky, {type AfterResponseHook, type BeforeRequestHook, type Input, type Options} from 'ky'

export const USER_AGENT = 'ccc-server/0.2.0'

const IS_DEBUG_KY = process.env['TRACE']?.split(',').includes('ky')

const traceBeforeHook: BeforeRequestHook = ({request}) => {
	console.log(`${request.method} ${request.url}`)
}

const traceAfterHook: AfterResponseHook = ({response}) => {
	console.log(`got ${response.url}`)
}

const beforeRequestHooks: BeforeRequestHook[] = IS_DEBUG_KY ? [traceBeforeHook] : []

const afterResponseHooks: AfterResponseHook[] = IS_DEBUG_KY ? [traceAfterHook] : []

/// How one attempt at an upstream request ended: its status class, or why it
/// has none.
export type UpstreamOutcome = '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'timeout' | 'network'

function hostOf(input: Parameters<typeof fetch>[0]): string {
	let url = input instanceof Request ? input.url : String(input)
	return URL.parse(url)?.host ?? 'unknown'
}

/// fetch, telling `record` how each attempt ended. ky retries and times out
/// around its `fetch`, so each attempt is told, and an attempt ky gives up on
/// is told once its fetch is aborted.
export function countingFetch(
	record: (host: string, outcome: UpstreamOutcome) => void,
): typeof fetch {
	return async (input, init) => {
		let host = hostOf(input)
		try {
			// looked up on each call, so tests can mock it
			let response = await fetch(input, init)
			record(host, `${Math.floor(response.status / 100).toFixed(0)}xx` as UpstreamOutcome)
			return response
		} catch (error) {
			let aborted =
				error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
			record(host, aborted ? 'timeout' : 'network')
			throw error
		}
	}
}

const recordUpstream = (host: string, outcome: UpstreamOutcome) => {
	Sentry.metrics.count('upstream.request', 1, {attributes: {host, outcome}})
}

export const http = ky.extend({
	headers: {'User-Agent': USER_AGENT},
	fetch: countingFetch(recordUpstream),
	timeout: 30_000,
	hooks: {
		beforeRequest: beforeRequestHooks,
		afterResponse: afterResponseHooks,
	},
})

export const getText = (input: Input, options?: Options) => http.get(input, options).text()
export const getJson = <T = unknown>(input: Input, options?: Options) =>
	http.get(input, options).json<T>()
