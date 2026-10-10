import {searchWords} from '../../source/student-work/posting-shape.ts'
import type {CarletonFilters} from './carleton-board.ts'

const ONE_HOUR = 60 * 60
const ONE_MINUTE = 60

const json = (body: unknown, status = 200, cacheSeconds?: number) =>
	Response.json(body, {
		status,
		...(cacheSeconds === undefined
			? {}
			: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
	})

const MAX_VALUES = 20
const MAX_QUERY = 100
const DATE = /^\d{4}-\d{2}-\d{2}$/u
const KNOWN = ['when', 'off_campus', 'posted_since', 'q', 'title', 'sort']

const once = (params: URLSearchParams, key: string): string | undefined | Error => {
	let values = params.getAll(key)
	if (values.length > 1) return new Error(`${key} can be given once`)
	return values[0]
}

/// The filters a request asks for, or the message for a 400.
export function parseCarletonFilters(params: URLSearchParams): CarletonFilters | string {
	for (let key of params.keys()) {
		if (!KNOWN.includes(key))
			return `unknown parameter ${key.slice(0, 40)}; use ${KNOWN.join(', ')}`
	}
	let filters: CarletonFilters = {
		when: [],
		offCampus: undefined,
		postedSince: undefined,
		q: [],
		title: [],
		sort: 'newest',
	}

	let when = params.getAll('when').flatMap((value) => value.split(','))
	if (when.length > MAX_VALUES) return 'too many values for when'
	for (let value of when) {
		if (value !== 'term' && value !== 'break') {
			return `when cannot be ${JSON.stringify(value.slice(0, 40))}; use term or break`
		}
		filters.when.push(value)
	}

	let offCampus = once(params, 'off_campus')
	if (offCampus instanceof Error) return offCampus.message
	if (offCampus !== undefined) {
		if (offCampus !== 'true' && offCampus !== 'false') return 'off_campus must be true or false'
		filters.offCampus = offCampus === 'true'
	}

	let since = once(params, 'posted_since')
	if (since instanceof Error) return since.message
	if (since !== undefined) {
		if (!DATE.test(since)) return 'posted_since must be YYYY-MM-DD'
		filters.postedSince = since
	}

	for (let key of ['q', 'title'] as const) {
		let text = once(params, key)
		if (text instanceof Error) return text.message
		if (text !== undefined) {
			if (text.length > MAX_QUERY) return `${key} must be at most ${String(MAX_QUERY)} characters`
			filters[key] = searchWords(text).slice(0, MAX_VALUES)
		}
	}

	let sort = once(params, 'sort')
	if (sort instanceof Error) return sort.message
	if (sort !== undefined) {
		if (sort !== 'newest' && sort !== 'relevance') return 'sort must be newest or relevance'
		filters.sort = sort
	}
	return filters
}

const board = (env: Env) => env.STUDENT_WORK.getByName('carleton')
const iso = (ms: number) => new Date(ms).toISOString()
const failed = (message: string) => json({message}, 502, ONE_MINUTE)

/// `/student-work/postings` at Carleton: the jobs, narrowed by the query.
export async function carletonPostings(env: Env, params: URLSearchParams) {
	let filters = parseCarletonFilters(params)
	if (typeof filters === 'string') return json({message: filters}, 400)
	let result = await board(env).carletonList(filters)
	if (result.state === 'error') return failed(result.error)
	return json(
		{updatedAt: iso(result.updatedAt), count: result.postings.length, postings: result.postings},
		200,
		ONE_HOUR,
	)
}

/// `/student-work/postings/:id` at Carleton: one job, with its description.
export async function carletonPosting(env: Env, id: string) {
	let result = await board(env).carletonOne(id)
	if (result.state === 'error') return failed(result.error)
	if (!result.posting) return json({message: 'no such posting on the board'}, 404, ONE_MINUTE)
	return json(result.posting, 200, ONE_HOUR)
}
