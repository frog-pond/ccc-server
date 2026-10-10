import {
	PASSED_HEADERS,
	UPSTREAM as MESSENGER_API,
	canonicalKey,
	isPassable,
	paginationLinks,
	rulesFor,
} from '../../../source/ccci-stolaf-college/v1/mess-shape.ts'
import {fetchSource} from '../client.ts'
import {defineSource} from '../define-source.ts'
import {CLIENT_MAX_AGE, ERROR_MAX_AGE, SOURCE_TTL} from '../lifetimes.ts'
import {registerSource} from '../registry.ts'
import {upstream} from '../upstream.ts'

const DAY = 24 * 60 * 60 * 1000

/// A Durable Object keeps a value in one SQLite row, which holds at most 2 MB;
/// an answer bigger than this is an error rather than a failed write.
const MAX_BODY = 1_900_000

/// A paper's WordPress REST API: where it is, and what a refusal calls it.
/// The papers run the same WordPress plugins, so the app makes the same
/// requests of each.
export type WordPressSite = {upstream: string; paper: string}

/// The Olaf Messenger's API, as the Node server's `mess` routes read it.
export const MESSENGER: WordPressSite = {upstream: MESSENGER_API, paper: 'the Olaf Messenger'}

/// The Carletonian's API.
export const CARLETONIAN: WordPressSite = {
	upstream: 'https://thecarletonian.com/wp-json/wp/v2',
	paper: 'The Carletonian',
}

/// Only these sites load: the site comes from the caller, and this must not
/// become a way to make the worker fetch anything.
const SITES: readonly WordPressSite[] = [MESSENGER, CARLETONIAN]

/// One request to a paper's WordPress API: a path under its `upstream`
/// (`posts`, `posts/123`) and its query string, as the app sent it.
export type WordPressParams = {site: WordPressSite; path: string; query: string}

/// The paper's answer, as it is passed on.
export type WordPressAnswer = {
	status: number
	type: string
	body: string
	headers: Record<string, string>
}

const hasBom = (body: string) => body.charCodeAt(0) === 0xfeff

/// A paper's WordPress REST API, kept in WordPress's own shape, the way
/// `makeWordpressRoute` in source/ccci-stolaf-college/v1/mess.ts serves the
/// Messenger's for the Node server. Every spelling of one request shares one
/// object.
export const wordpressApi = defineSource({
	name: 'wordpress-api',
	key: ({site, path, query}: WordPressParams) =>
		`${site.upstream}/${canonicalKey(path, new URLSearchParams(query))}`,
	async load(params) {
		let site = SITES.find(({upstream}) => upstream === params.site.upstream)
		if (!site) throw new Error(`${params.site.upstream} is not a WordPress API this reads`)
		let {path, query} = params
		// the request was checked by the route; checked again, as the url is built from it
		let [resource = '', id, ...more] = path.split('/')
		if (more.length > 0 || 'refusal' in rulesFor(resource, id, new URLSearchParams(query))) {
			throw new Error(`${path} is not a request this reads from ${site.paper}`)
		}
		let url = `${site.upstream}/${path}${query ? `?${query}` : ''}`
		let named = `${site.upstream}/${path}`
		// the host is fixed above, so a redirect to another is not followed
		let response = await upstream(url)
		let type = response.headers.get('content-type')
		// a redirect is not the answer either, even one that says it is JSON
		let redirected = response.status >= 300 && response.status < 400
		if (!isPassable(response.status, type) || redirected) {
			await response.body?.cancel()
			throw new Error(`${site.paper} responded ${String(response.status)} for ${named}`)
		}
		let body = await response.text()
		// a stray byte order mark from a theme's PHP file is dropped: JSON.parse
		// refuses it, and the app needs none
		if (hasBom(body)) body = body.slice(1)
		if (body.length > MAX_BODY) throw new Error(`The answer for ${named} is too large`)
		try {
			JSON.parse(body)
		} catch {
			throw new Error(`${site.paper} did not answer with JSON for ${named}`)
		}
		let headers: Record<string, string> = {}
		for (let name of PASSED_HEADERS) {
			let value = response.headers.get(name)
			if (value !== null) headers[name] = value
		}
		return {status: response.status, type, body, headers} satisfies WordPressAnswer
	},
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(wordpressApi)

const message = (text: string, status: number, cacheSeconds?: number) =>
	Response.json(
		{message: text},
		{
			status,
			...(cacheSeconds === undefined
				? {}
				: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
		},
	)

/// `/news/<paper>/wp/v2/<resource>[/<id>]`: a paper's WordPress API, for the
/// requests the app makes and nothing else, with paging links on the lists the
/// app pages through. A 4xx from the paper is passed on but not marked
/// cacheable; with nothing stored and the paper failing this is a 502.
export async function wordpress(
	site: WordPressSite,
	url: URL,
	resource: string,
	id: string | undefined,
	env: Env,
): Promise<Response> {
	let query = url.search.slice(1)
	let verdict = rulesFor(resource, id, new URLSearchParams(query), site.paper)
	if ('refusal' in verdict) return message(verdict.refusal.message, verdict.refusal.status)

	let path = id === undefined ? resource : `${resource}/${id}`
	let answer: WordPressAnswer
	try {
		answer = (await fetchSource(env, wordpressApi, {site, path, query})).value
	} catch (err) {
		console.error(err, {path})
		return message(`${site.paper} could not be reached for ${path}`, 502, ERROR_MAX_AGE)
	}

	let headers = new Headers({'Content-Type': answer.type, ...answer.headers})
	if (answer.status === 200) {
		headers.set('Cache-Control', `public, max-age=${CLIENT_MAX_AGE.toFixed(0)}`)
		let totalPages = Number(answer.headers['x-wp-totalpages'])
		if (Object.hasOwn(verdict.rules.params, 'page') && Number.isInteger(totalPages)) {
			let link = paginationLinks(url.pathname, query, totalPages)
			if (link) headers.set('Link', link)
		}
	}
	return new Response(answer.body, {status: answer.status, headers})
}
