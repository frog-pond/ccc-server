import {Buffer} from 'node:buffer'
import QuickLRU from 'quick-lru'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {http} from '../../ccc-lib/http.ts'
import type {Context} from '../../ccc-server/context.ts'

/// The Olaf Messenger's WordPress REST API, which this module serves the app
/// a cached copy of, in WordPress's own shape.
export const UPSTREAM = 'https://olafmessenger.com/wp-json/wp/v2'

const INTEGER = /^\d+$/u
const INTEGERS = /^\d+(?:,\d+)*$/u
const FIELDS = /^[a-z_:]+(?:,[a-z_:]+)*$/u
const EMBED = /^(?:true|wp:[a-z]+(?:,wp:[a-z]+)*)$/u
const BOOLEAN = /^(?:true|false)$/u
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/// The query parameters a request may carry, how long its answer is cached,
/// and how many last good copies of its answers are kept for an outage. Each
/// kind of request keeps its own, so stories read by the hundred cannot push
/// out the one category tree every screen needs.
export interface Rules {
	params: Record<string, RegExp>
	ttl: number
	keep: number
}

/// What the app asks the paper for, and nothing else: anything more would make
/// this an open proxy, and every new query string another cached copy.
const RESOURCES: Record<string, {list: Rules; item?: Rules}> = {
	posts: {
		list: {
			params: {
				per_page: INTEGER,
				page: INTEGER,
				_embed: EMBED,
				_fields: FIELDS,
				categories: INTEGERS,
				include: INTEGERS,
				staff_name: INTEGER,
			},
			ttl: 5 * ONE_MINUTE,
			keep: 100,
		},
		item: {params: {_embed: EMBED, _fields: FIELDS}, ttl: ONE_HOUR, keep: 200},
	},
	categories: {list: {params: {per_page: INTEGER, _fields: FIELDS}, ttl: ONE_DAY, keep: 4}},
	media: {
		list: {
			params: {include: INTEGERS, per_page: INTEGER, _fields: FIELDS},
			ttl: ONE_DAY,
			keep: 100,
		},
	},
	staff_profile: {
		list: {
			params: {
				staff_name: INTEGER,
				staff_year: INTEGER,
				per_page: INTEGER,
				page: INTEGER,
				_embed: EMBED,
				_fields: FIELDS,
			},
			ttl: ONE_DAY,
			keep: 50,
		},
	},
	staff_year: {
		list: {
			params: {hide_empty: BOOLEAN, per_page: INTEGER, _fields: FIELDS},
			ttl: ONE_DAY,
			keep: 4,
		},
	},
	pages: {list: {params: {slug: SLUG, _fields: FIELDS}, ttl: ONE_DAY, keep: 4}},
}

export type Verdict = {rules: Rules} | {refusal: {status: 400 | 404; message: string}}

const refuse = (status: 400 | 404, message: string): Verdict => ({refusal: {status, message}})

/// The rules for a request to `resource` (and `id`, for one post), or why it is
/// refused. Values are checked decoded; the query string itself is forwarded as
/// it came.
export function rulesFor(
	resource: string,
	id: string | undefined,
	query: URLSearchParams,
): Verdict {
	let entry = Object.hasOwn(RESOURCES, resource) ? RESOURCES[resource] : undefined
	let rules = id === undefined ? entry?.list : entry?.item
	if (!rules || (id !== undefined && !INTEGER.test(id))) {
		let name = id === undefined ? resource : `${resource}/:id`
		return refuse(404, `the Olaf Messenger has no ${name}`)
	}

	for (let name of new Set(query.keys())) {
		let pattern = Object.hasOwn(rules.params, name) ? rules.params[name] : undefined
		if (!pattern) return refuse(400, `unknown parameter ${name}`)
		let values = query.getAll(name)
		if (values.length > 1) return refuse(400, `parameter ${name} given more than once`)
		if (!pattern.test(values[0] ?? '')) return refuse(400, `malformed parameter ${name}`)
	}
	return {rules}
}

/// `querystring` asking for `page` instead of the page it named. The page goes
/// last, and the first page goes without one, as the app asks for them, so a
/// followed link and the app's own request share a cached copy. The rest stays
/// as it came, since re-encoding it would turn `_fields`' commas into %2C.
export function withPage(querystring: string, page: number): string {
	let parts = querystring.split('&').filter((part) => part !== '' && !part.startsWith('page='))
	if (page > 1) parts.push(`page=${page.toFixed(0)}`)
	return parts.join('&')
}

/// An RFC 8288 Link header for a page of a list `totalPages` long: first, prev,
/// next and last, each at `path`. Nothing for an empty list.
export function paginationLinks(
	path: string,
	querystring: string,
	totalPages: number,
): string | undefined {
	if (totalPages < 1) return undefined
	let page = Number(new URLSearchParams(querystring).get('page') ?? '1')
	let link = (target: number, rel: string) => {
		let query = withPage(querystring, target)
		return `<${path}${query ? `?${query}` : ''}>; rel="${rel}"`
	}

	let links = [link(1, 'first')]
	if (page > 1) links.push(link(page - 1, 'prev'))
	if (page < totalPages) links.push(link(page + 1, 'next'))
	links.push(link(totalPages, 'last'))
	return links.join(', ')
}

/// A WordPress answer as this route passes it on.
export interface Answer {
	status: number
	type: string
	body: string
	headers: Record<string, string>
}

/// WordPress's paging headers, which the app may read in either mode.
const PASSED_HEADERS = ['x-wp-total', 'x-wp-totalpages']

/// How long the paper has to answer: well inside the app's own 10 seconds, so
/// that while the paper hangs, the last good copy reaches the reader in time.
const UPSTREAM_TIMEOUT = 7_000

/// Refusals that say nothing about the request, only about this server's
/// standing with the paper's host -- a rate limit, a firewall, a timeout --
/// which every phone shares, since they all reach the paper from here.
const OUTAGE_STATUSES = new Set([403, 408, 429])

/// The paper's answer, or nothing when it could not give one: a timeout, a
/// connection that never answered, a 5xx, a refusal in `OUTAGE_STATUSES`, or
/// a page other than JSON, such as a maintenance page or a bot check, which
/// must not be cached as the Messenger's data.
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
		let type = response.headers.get('content-type') ?? 'application/json'
		if (!type.includes('json')) return undefined
		if (response.status >= 500 || OUTAGE_STATUSES.has(response.status)) return undefined
		let headers: Record<string, string> = {}
		for (let name of PASSED_HEADERS) {
			let value = response.headers.get(name)
			if (value !== null) headers[name] = value
		}
		return {status: response.status, type, body: await response.text(), headers}
	} catch {
		return undefined
	}
}

function send(ctx: Context, answer: Answer): void {
	ctx.status = answer.status
	// the type goes first, or Koa guesses one from the string body
	ctx.type = answer.type
	ctx.set(answer.headers)
	let totalPages = Number(answer.headers['x-wp-totalpages'])
	if (answer.status === 200 && Number.isInteger(totalPages)) {
		let link = paginationLinks(ctx.path, ctx.querystring, totalPages)
		if (link) ctx.set('Link', link)
	}
	// bytes, not a string: the response cache would store a string as a JSON value, quoting it
	ctx.body = Buffer.from(answer.body)
}

/// The Messenger's WordPress API, answered from the response cache, then the
/// paper, then -- while the paper is failing -- the last good copy of each URL.
export function makeWordpressRoute({timeout = UPSTREAM_TIMEOUT}: {timeout?: number} = {}) {
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

		// A hit's Cache-Control is the one stored with it, which for a last good
		// copy is a minute, not the whole ttl.
		if (ctx.cached(ttl)) return

		let path = id === undefined ? resource : `${resource}/${id}`
		let url = `${UPSTREAM}/${path}${ctx.querystring ? `?${ctx.querystring}` : ''}`
		let answer = await fetchUpstream(url, timeout)

		if (answer) {
			// a 4xx is passed on but not cached: the cache holds only 200s, and
			// Cache-Control goes only on an answer worth keeping
			if (answer.status === 200) {
				lastGood.set(url, answer)
				ctx.cacheControl(ttl)
			}
			send(ctx, answer)
			return
		}

		let copy = lastGood.get(url)
		if (!copy) {
			ctx.throw(502, `the Olaf Messenger could not be reached for ${path}`)
			return
		}
		// ask the paper again soon, rather than holding the old copy for the whole ttl
		ctx.setCacheTTL(ONE_MINUTE)
		ctx.cacheControl(ONE_MINUTE)
		send(ctx, copy)
	}
}

export const wordpress = makeWordpressRoute()
