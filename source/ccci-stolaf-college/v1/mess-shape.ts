import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {WORDPRESS_PAGING_HEADERS} from '../../ccc-lib/stored-headers.ts'

/// What the app may ask of the Olaf Messenger's WordPress, and how a page of
/// it is linked. Nothing here fetches, so the Node server and the Cloudflare
/// Worker share it.

/// The Olaf Messenger's WordPress REST API, which this module serves the app
/// a cached copy of, in WordPress's own shape.
export const UPSTREAM = 'https://olafmessenger.com/wp-json/wp/v2'

// Each value has one meaning and a size WordPress serves, so anything the app
// would not ask for is refused before it costs a fetch from the paper. Other
// spellings of the same request -- percent-encoded, or in another order -- are
// let through, and share one cached copy (see `canonicalKey`).
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
	'alt_text',
	'_links',
	'_embedded',
]
const FIELDS = listOf(FIELD_NAMES.join('|'), FIELD_NAMES.length)
const EMBED = /^(?:true|wp:featuredmedia(?:,wp:term)?|wp:term)$/u
const BOOLEAN = /^(?:true|false)$/u
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/// The query parameters a request may carry, and how long its answer is cached.
export interface Rules {
	params: Record<string, RegExp>
	ttl: number
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
		},
		item: {params: {_embed: EMBED, _fields: FIELDS}, ttl: ONE_HOUR},
	},
	categories: {list: {params: {per_page: PER_PAGE, _fields: FIELDS}, ttl: ONE_DAY}},
	media: {
		list: {
			params: {include: IDS, per_page: PER_PAGE, _fields: FIELDS},
			ttl: ONE_DAY,
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
		},
	},
	staff_year: {
		list: {
			params: {hide_empty: BOOLEAN, per_page: PER_PAGE, _fields: FIELDS},
			ttl: ONE_DAY,
		},
	},
	pages: {list: {params: {slug: SLUG, _fields: FIELDS}, ttl: ONE_DAY}},
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
	/// what the 404 calls the site, for another paper on the same WordPress plugins
	paper = 'the Olaf Messenger',
): Verdict {
	let entry = Object.hasOwn(RESOURCES, resource) ? RESOURCES[resource] : undefined
	let rules = id === undefined ? entry?.list : entry?.item
	if (!rules || (id !== undefined && !INTEGER.test(id))) {
		let name = id === undefined ? resource : `${resource}/:id`
		return refuse(404, `${paper} has no ${name}`)
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

/// The key a request's cached copy is kept under: its path and its query
/// decoded and in order of name, so every spelling of one request shares one
/// copy, and no number of them can push out the copy the app's own needs.
export function canonicalKey(path: string, query: URLSearchParams): string {
	let sorted = [...query].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	return `${path}?${sorted.map(([name, value]) => `${name}=${value}`).join('&')}`
}

/// WordPress's paging headers, which the app may read in either mode. The
/// response cache keeps them, with `Link`, through its `STORED_HEADERS`.
export const PASSED_HEADERS = WORDPRESS_PAGING_HEADERS

/// Refusals that say nothing about the request, only about this server's
/// standing with the paper's host -- a rate limit, a firewall, a timeout --
/// which every phone shares, since they all reach the paper from here.
export const OUTAGE_STATUSES = new Set([403, 408, 429])

/// Whether the paper's answer is one to pass on: JSON, and neither a 5xx nor
/// a refusal in `OUTAGE_STATUSES`. Anything else -- a maintenance page, a bot
/// check -- must not be kept as the Messenger's data.
export function isPassable(status: number, type: string | null): type is string {
	return Boolean(type?.includes('json')) && status < 500 && !OUTAGE_STATUSES.has(status)
}
