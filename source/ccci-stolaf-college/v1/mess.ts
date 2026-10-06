import {Buffer} from 'node:buffer'
import QuickLRU from 'quick-lru'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {http} from '../../ccc-lib/http.ts'
import type {Context} from '../../ccc-server/context.ts'

/// The Olaf Messenger's WordPress REST API, which this module serves the app
/// a cached copy of, in WordPress's own shape.
export const UPSTREAM = 'https://olafmessenger.com/wp-json/wp/v2'

// Each value has one meaning and a size WordPress serves, so anything the app
// would not ask for is refused before it costs a fetch from the paper. Other
// spellings of the same request -- percent-encoded, or in another order -- are
// let through, and share one last good copy (see `canonicalKey`).
const ID = '[1-9][0-9]{0,9}'
/// `items` comma-separated, from one to `max` of them.
const listOf = (items: string, max: number) =>
	new RegExp(`^(?:${items})(?:,(?:${items})){0,${(max - 1).toFixed(0)}}$`, 'u')

const INTEGER = new RegExp(`^${ID}$`, 'u')
const PER_PAGE = /^(?:[1-9][0-9]?|100)$/u
/// WordPress answers at most 100 ids at once.
const IDS = listOf(ID, 100)
/// The fields the app reads, in any order.
const FIELD_NAMES = [
	'id',
	'name',
	'parent',
	'date',
	'title',
	'categories',
	'featured_media',
	'content',
	'excerpt',
	'source_url',
	'media_details',
	'caption',
	'_links',
	'_embedded',
]
const FIELDS = listOf(FIELD_NAMES.join('|'), FIELD_NAMES.length)
const EMBED = /^(?:true|wp:featuredmedia(?:,wp:term)?|wp:term)$/u
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
				per_page: PER_PAGE,
				page: INTEGER,
				_embed: EMBED,
				_fields: FIELDS,
				categories: IDS,
				include: IDS,
				staff_name: INTEGER,
			},
			ttl: 5 * ONE_MINUTE,
			keep: 20,
		},
		item: {params: {_embed: EMBED, _fields: FIELDS}, ttl: ONE_HOUR, keep: 100},
	},
	categories: {list: {params: {per_page: PER_PAGE, _fields: FIELDS}, ttl: ONE_DAY, keep: 4}},
	media: {
		list: {
			params: {include: IDS, per_page: PER_PAGE, _fields: FIELDS},
			ttl: ONE_DAY,
			keep: 50,
		},
	},
	staff_profile: {
		list: {
			params: {
				staff_name: INTEGER,
				staff_year: INTEGER,
				per_page: PER_PAGE,
				page: INTEGER,
				_embed: EMBED,
				_fields: FIELDS,
			},
			ttl: ONE_DAY,
			keep: 20,
		},
	},
	staff_year: {
		list: {
			params: {hide_empty: BOOLEAN, per_page: PER_PAGE, _fields: FIELDS},
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
	// a name is compared decoded, as `rulesFor` reads it, so `%70age` is `page` too
	let parts = querystring
		.split('&')
		.filter((part) => part !== '' && new URLSearchParams(part).keys().next().value !== 'page')
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
	/// Bytes, not a string: the response cache would store a string as a JSON
	/// value, quoting it. It is the same Buffer the response cache keeps, so a
	/// last good copy costs no memory while the cached copy lives.
	body: Buffer
	headers: Record<string, string>
}

/// WordPress's paging headers, which the app may read in either mode.
const PASSED_HEADERS = ['x-wp-total', 'x-wp-totalpages']

/// The headers a cached copy of this route's answers must keep, for the
/// response cache's `storedHeaders`.
export const PAGING_HEADERS = ['link', ...PASSED_HEADERS]

/// UTF-8's byte order mark.
const BYTE_ORDER_MARK = Buffer.from([0xef, 0xbb, 0xbf])

/// How long the paper has to answer: well inside the app's own 10 seconds, so
/// that while the paper hangs, the last good copy reaches the reader in time.
const UPSTREAM_TIMEOUT = 7_000

/// Refusals that say nothing about the request, only about this server's
/// standing with the paper's host -- a rate limit, a firewall, a timeout --
/// which every phone shares, since they all reach the paper from here.
const OUTAGE_STATUSES = new Set([403, 408, 429])

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
		if (!type?.includes('json')) return undefined
		if (response.status >= 500 || OUTAGE_STATUSES.has(response.status)) return undefined
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
		let link = paginationLinks(ctx.path, ctx.querystring, totalPages)
		if (link) ctx.set('Link', link)
	}
	ctx.body = answer.body
}

/// The key a request's last good copy is kept under: its path and its query
/// decoded and in order of name, so every spelling of one request shares one
/// copy, and no number of them can push out the copy the app's own needs.
export function canonicalKey(path: string, query: URLSearchParams): string {
	let sorted = [...query].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	return `${path}?${sorted.map(([name, value]) => `${name}=${value}`).join('&')}`
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

		// A hit's Cache-Control is the life its copy has left, which for a last
		// good copy is at most a minute, not the whole ttl.
		if (ctx.cached(ttl)) return

		let path = id === undefined ? resource : `${resource}/${id}`
		let url = `${UPSTREAM}/${path}${ctx.querystring ? `?${ctx.querystring}` : ''}`
		let key = canonicalKey(path, new URLSearchParams(ctx.querystring))
		let answer = await fetchUpstream(url, timeout)

		if (answer) {
			// a 4xx is passed on but not cached: the cache holds only 200s, and
			// Cache-Control goes only on an answer worth keeping
			if (answer.status === 200) {
				lastGood.set(key, answer)
				ctx.cacheControl(ttl)
			}
			send(ctx, answer, verdict.rules)
			return
		}

		let copy = lastGood.get(key)
		if (!copy) {
			ctx.throw(502, `the Olaf Messenger could not be reached for ${path}`)
			return
		}
		// ask the paper again soon, rather than holding the old copy for the whole ttl
		ctx.setCacheTTL(ONE_MINUTE)
		ctx.cacheControl(ONE_MINUTE)
		send(ctx, copy, verdict.rules)
	}
}

export const wordpress = makeWordpressRoute()
