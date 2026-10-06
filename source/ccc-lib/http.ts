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

/// The colleges' own domains, any host in which is named in a metric.
const KNOWN_DOMAINS = [
	'stolaf.edu',
	'carleton.edu',
	'cafebonappetit.com',
	'presence.io',
	'olafmessenger.com',
	'thecarletonian.com',
	'krlx.org',
	'northfieldmn.gov',
]

/// Hosts on shared platforms, where anyone can have a subdomain, that the
/// server fetches by name.
const KNOWN_HOSTS = new Set([
	'stodevx.github.io',
	'carls-app.github.io',
	'www.googleapis.com',
	'feed.podbean.com',
	'fa-ewur-saasfaprod1.fa.ocs.oraclecloud.com',
])

/// A host as a metric names it: itself, without a port, if the server fetches
/// it or it's in a college's domains, and otherwise "other". Some routes fetch
/// whatever URL a client sends, so naming every host would let a client mint
/// a new series per request.
export function metricHost(host: string): string {
	let hostname = host.replace(/:\d+$/u, '')
	let known =
		KNOWN_HOSTS.has(hostname) ||
		KNOWN_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
	return known ? hostname : 'other'
}

const recordUpstream = (host: string, outcome: UpstreamOutcome) => {
	Sentry.metrics.count('upstream.request', 1, {attributes: {host: metricHost(host), outcome}})
}

/// The longest any one call may take, retries and the waits between them
/// included. ky applies it to the body read of `getText` and `getJson` too;
/// a caller reading a raw response's body itself passes it as a `signal`.
export const TOTAL_TIMEOUT = 60_000

export const http = ky.extend({
	headers: {'User-Agent': USER_AGENT},
	fetch: countingFetch(recordUpstream),
	timeout: 30_000,
	totalTimeout: TOTAL_TIMEOUT,
	hooks: {
		beforeRequest: beforeRequestHooks,
		afterResponse: afterResponseHooks,
	},
})

export const getText = (input: Input, options?: Options) => http.get(input, options).text()
export const getJson = <T = unknown>(input: Input, options?: Options) =>
	http.get(input, options).json<T>()
