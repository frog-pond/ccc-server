import {unavailableOrgs} from '../../source/ccci-carleton-college/v1/deprecated.ts'
import {deprecatedJobs, RETIRED_JOBS_TEXT} from '../../source/student-work/retired-jobs.ts'
import {searchWords} from '../../source/student-work/posting-shape.ts'
import {CLIENT_MAX_AGE, ERROR_MAX_AGE} from './lifetimes.ts'
import type {OrgFilters} from './student-orgs-do.ts'

const json = (body: unknown, status = 200, cacheSeconds?: number) =>
	Response.json(body, {
		status,
		...(cacheSeconds === undefined
			? {}
			: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
	})

const failed = (message: string) => json({message}, 502, ERROR_MAX_AGE)

/// What a campus's `/orgs` answers: St. Olaf's orgs from Presence, or a notice
/// that Carleton's cannot be read.
export type Orgs = 'presence' | 'unavailable'

/// What a campus's `/jobs` answers: Carleton's Student Employment jobs, or a
/// notice that the listings moved.
export type Jobs = 'carleton' | 'retired'

const list = (env: Env) => env.STUDENT_ORGS.getByName('stolaf')

const MAX_VALUES = 20
const MAX_QUERY = 100

/// The filters a request asks for, or the message for a 400. Other parameters
/// are ignored, as the Node server ignores them.
export function parseOrgFilters(params: URLSearchParams): OrgFilters | string {
	let category = params.getAll('category')
	if (category.length > MAX_VALUES) return 'too many values for category'
	if (category.some((value) => value.length > MAX_QUERY)) {
		return `category must be at most ${String(MAX_QUERY)} characters`
	}
	let q = params.getAll('q')
	if (q.length > 1) return 'q can be given once'
	let text = q[0] ?? ''
	if (text.length > MAX_QUERY) return `q must be at most ${String(MAX_QUERY)} characters`
	return {q: searchWords(text).slice(0, MAX_VALUES), category}
}

/// `/orgs`: every org, in list order, or those the query narrows it to; or,
/// for Carleton, the notice the Node server answers, with nothing fetched.
export async function orgs(env: Env, kind: Orgs, params: URLSearchParams) {
	if (kind === 'unavailable') return json(unavailableOrgs(), 200, CLIENT_MAX_AGE)
	let filters = parseOrgFilters(params)
	if (typeof filters === 'string') return json({message: filters}, 400)
	let result = await list(env).list(filters)
	if (result.state === 'error') return failed(result.error)
	return json(result.orgs, 200, CLIENT_MAX_AGE)
}

/// `/orgs/categories`: each category with the uris of its orgs.
export async function orgCategories(env: Env) {
	let result = await list(env).categories()
	if (result.state === 'error') return failed(result.error)
	return json(result.categories, 200, CLIENT_MAX_AGE)
}

/// Presence's slugs: lowercase words and digits joined by hyphens.
const ORG_URI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/// `/orgs/uri/:uri`: one org with its contacts, advisors and links.
export async function org(env: Env, uri: string) {
	// checked before the object, so a made-up slug never reaches it
	if (uri.length > MAX_QUERY || !ORG_URI.test(uri)) return json({error: 'not found'}, 404)
	let result = await list(env).org(uri)
	if (result.state === 'error') return failed(result.error)
	if (!result.org) return json({message: `No student org has the uri ${uri}`}, 404, ERROR_MAX_AGE)
	return json(result.org, 200, CLIENT_MAX_AGE)
}

/// The day the retired jobs notice was last changed, which it reads as its
/// date. A fixed day keeps the notice the same at any time, so a client
/// re-checking it is answered with a 304.
const RETIRED_JOBS_DATE = new Date('2026-10-10T12:00:00Z')

/// `/jobs`: Carleton's jobs as the Node server lists them, read from the
/// student work board, or the notice that St. Olaf's moved.
export async function jobs(env: Env, kind: Jobs) {
	if (kind === 'retired') {
		return json(deprecatedJobs(RETIRED_JOBS_TEXT, RETIRED_JOBS_DATE), 200, CLIENT_MAX_AGE)
	}
	let result = await env.STUDENT_WORK.getByName('carleton').carletonJobs()
	if (result.state === 'error') return failed(result.error)
	return json(result.jobs, 200, CLIENT_MAX_AGE)
}
