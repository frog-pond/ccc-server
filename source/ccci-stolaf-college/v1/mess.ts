import {Buffer} from 'node:buffer'
import QuickLRU from 'quick-lru'
import * as Sentry from '@sentry/node'
import {ONE_DAY, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {http} from '../../ccc-lib/http.ts'
import type {Context} from '../../ccc-server/context.ts'
import {
	PASSED_HEADERS,
	UPSTREAM,
	canonicalKey,
	isPassable,
	paginationLinks,
	rulesFor,
	type Rules,
} from './mess-shape.ts'

export {
	UPSTREAM,
	canonicalKey,
	paginationLinks,
	rulesFor,
	withPage,
	type Rules,
	type Verdict,
} from './mess-shape.ts'

/// A WordPress answer as this route passes it on.
export interface Answer {
	status: number
	type: string
	/// Bytes, not a string: the response cache would store a string as a JSON
	/// value, quoting it. It is the same Buffer the response cache keeps, so a
	/// last good copy costs no memory while the cached copy lives.
	body: Buffer
	headers: Record<string, string>
}

/// UTF-8's byte order mark.
const BYTE_ORDER_MARK = Buffer.from([0xef, 0xbb, 0xbf])

/// How long the paper has to answer: well inside the app's own 10 seconds, so
/// that while the paper hangs, the last good copy reaches the reader in time.
const UPSTREAM_TIMEOUT = 7_000

/// How long a URL the paper failed to answer goes unasked: a phone in an
/// outage retries several times over (ky's retries, times TanStack's), and
/// each attempt would otherwise be another fetch from the paper.
const FAILURE_MEMORY = 30_000

/// How many URLs' failures are remembered at once.
const FAILURES_KEPT = 1000

/// The paper's answer, or nothing when it could not give one: a timeout, a
/// connection that never answered, a 5xx, a refusal in `OUTAGE_STATUSES`, or
/// anything but JSON that parses -- a maintenance page, a bot check, or a PHP
/// warning ahead of the JSON -- which must not be cached as the Messenger's data.
async function fetchUpstream(url: string, timeout: number): Promise<Answer | undefined> {
	try {
		// no retries: a failure is answered from the last good copy, and the app retries on its own
		let response = await http.get(url, {
			throwHttpErrors: false,
			retry: 0,
			timeout,
			// the signal bounds the body read too, which ky's timeout doesn't reach
			signal: AbortSignal.timeout(timeout),
		})
		let type = response.headers.get('content-type')
		if (!isPassable(response.status, type)) {
			// let the connection go now, rather than when the timeout fires
			await response.body?.cancel().catch(() => undefined)
			return undefined
		}
		let body = Buffer.from(await response.arrayBuffer())
		// A byte order mark, which a stray one in a theme's PHP file puts ahead of
		// every answer, is dropped: JSON.parse refuses it, and the app needs none.
		if (body.subarray(0, 3).equals(BYTE_ORDER_MARK)) body = body.subarray(3)
		// throws, and so fails, for anything but JSON
		JSON.parse(body.toString('utf8'))
		let headers: Record<string, string> = {}
		for (let name of PASSED_HEADERS) {
			let value = response.headers.get(name)
			if (value !== null) headers[name] = value
		}
		return {status: response.status, type, body, headers}
	} catch {
		return undefined
	}
}

/// Sends `answer`, with paging links when the list is one `rules` lets the app
/// page through: a link to a page this route would refuse is no use to anyone.
function send(ctx: Context, answer: Answer, rules: Rules): void {
	ctx.status = answer.status
	// the type goes first, or Koa guesses one from the string body
	ctx.type = answer.type
	ctx.set(answer.headers)
	let totalPages = Number(answer.headers['x-wp-totalpages'])
	let paged = Object.hasOwn(rules.params, 'page')
	if (paged && answer.status === 200 && Number.isInteger(totalPages)) {
		// `ctx.path` never holds a prefix a proxy in front strips, so these links
		// are right only while nginx/default.conf passes `location /` through
		// unrewritten. Rewrite them too if that changes.
		let link = paginationLinks(ctx.path, ctx.querystring, totalPages)
		if (link) ctx.set('Link', link)
	}
	ctx.body = answer.body
}

/// The Messenger's WordPress API, answered from the response cache, then the
/// paper, then -- while the paper is failing -- the last good copy of each URL.
/// A URL the paper just failed is not asked for again for `failureMemory`.
export function makeWordpressRoute({
	timeout = UPSTREAM_TIMEOUT,
	failureMemory = FAILURE_MEMORY,
}: {timeout?: number; failureMemory?: number} = {}) {
	let failed = new QuickLRU<string, true>({maxSize: FAILURES_KEPT, maxAge: failureMemory})
	let copies = new Map<Rules, QuickLRU<string, Answer>>()
	let lastGoodFor = (rules: Rules) => {
		let store = copies.get(rules)
		if (!store) {
			store = new QuickLRU<string, Answer>({maxSize: rules.keep, maxAge: 7 * ONE_DAY})
			copies.set(rules, store)
		}
		return store
	}

	return async function wordpress(ctx: Context): Promise<void> {
		let {resource = '', id} = ctx.params
		let verdict = rulesFor(resource, id, new URLSearchParams(ctx.querystring))
		if ('refusal' in verdict) {
			ctx.throw(verdict.refusal.status, verdict.refusal.message)
			return
		}
		let {ttl} = verdict.rules
		let lastGood = lastGoodFor(verdict.rules)
		let path = id === undefined ? resource : `${resource}/${id}`
		let key = canonicalKey(path, new URLSearchParams(ctx.querystring))

		// Declared before asking the cache, so a hit counts its max-age down to
		// the life its copy has left: at most a minute for a last good copy.
		ctx.cacheControl(ttl)
		if (ctx.cached(ttl)) {
			// a read keeps its last good copy among the most recent, so in an
			// outage the stories read most are the ones still to hand
			lastGood.get(key)
			return
		}

		let url = `${UPSTREAM}/${path}${ctx.querystring ? `?${ctx.querystring}` : ''}`
		let answer = failed.has(key) ? undefined : await fetchUpstream(url, timeout)

		if (answer) {
			if (answer.status === 200) {
				lastGood.set(key, answer)
			} else {
				// a 4xx is passed on but not cached, so it says nothing of keeping it
				ctx.remove('Cache-Control')
			}
			send(ctx, answer, verdict.rules)
			return
		}

		if (!failed.has(key)) failed.set(key, true)
		let copy = lastGood.get(key)
		Sentry.metrics.count('mess.fallback', 1, {attributes: {outcome: copy ? 'stale' : '502'}})
		if (!copy) {
			ctx.throw(502, `the Olaf Messenger could not be reached for ${path}`)
			return
		}
		// ask the paper again soon, rather than holding the old copy for the whole ttl
		ctx.setCacheTTL(ONE_MINUTE)
		ctx.cacheControl(ONE_MINUTE)
		ctx.cacheDetail('stale')
		send(ctx, copy, verdict.rules)
	}
}

export const wordpress = makeWordpressRoute()
