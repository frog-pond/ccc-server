import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'

/// The Olaf Messenger's WordPress REST API, which this module serves the app
/// a cached copy of, in WordPress's own shape.
export const UPSTREAM = 'https://olafmessenger.com/wp-json/wp/v2'

const INTEGER = /^\d+$/u
const INTEGERS = /^\d+(?:,\d+)*$/u
const FIELDS = /^[a-z_:]+(?:,[a-z_:]+)*$/u
const EMBED = /^(?:true|wp:[a-z]+(?:,wp:[a-z]+)*)$/u
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
				per_page: INTEGER,
				page: INTEGER,
				_embed: EMBED,
				_fields: FIELDS,
				categories: INTEGERS,
				include: INTEGERS,
				staff_name: INTEGER,
			},
			ttl: 5 * ONE_MINUTE,
		},
		item: {params: {_embed: EMBED, _fields: FIELDS}, ttl: ONE_HOUR},
	},
	categories: {list: {params: {per_page: INTEGER, _fields: FIELDS}, ttl: ONE_DAY}},
	media: {list: {params: {include: INTEGERS, per_page: INTEGER, _fields: FIELDS}, ttl: ONE_DAY}},
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
		},
	},
	staff_year: {
		list: {params: {hide_empty: BOOLEAN, per_page: INTEGER, _fields: FIELDS}, ttl: ONE_DAY},
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
