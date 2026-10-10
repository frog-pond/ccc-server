import type {
	CarletonPosting,
	CarletonPostingWithDescription,
} from '../../source/student-work/carleton-shape.ts'
import {searchWords} from '../../source/student-work/posting-shape.ts'
import {fetchSource} from './client.ts'
import {carletonStudentWork} from './sources/carleton-student-work.ts'

const ONE_HOUR = 60 * 60
const ONE_MINUTE = 60

const json = (body: unknown, status = 200, cacheSeconds?: number) =>
	Response.json(body, {
		status,
		...(cacheSeconds === undefined
			? {}
			: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
	})

/// What a list can be narrowed by. Values of one key are alternatives; keys
/// narrow together.
export interface CarletonFilters {
	/// available during term, during break
	when: ('term' | 'break')[]
	/// community-based work-study (true) or on campus (false)
	offCampus: boolean | undefined
	postedSince: string | undefined
	/// words that must each start a word of the title or description
	q: string[]
	/// words that must each start a word of the title
	title: string[]
	sort: 'newest' | 'relevance'
}

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

/// Whether every word starts one of the words.
const startsAll = (words: string[], within: string[]) =>
	words.every((word) => within.some((candidate) => candidate.startsWith(word)))

/// How many of the words start one of the words.
const starts = (words: string[], within: string[]) =>
	words.filter((word) => within.some((candidate) => candidate.startsWith(word))).length

/// The postings a request asks for, in its order: newest first, or for
/// `sort=relevance` the best match first (a title match counting five times a
/// description match), newest first among equals.
export function filterCarleton(
	postings: CarletonPostingWithDescription[],
	filters: CarletonFilters,
): CarletonPosting[] {
	let words = [...filters.q, ...filters.title]
	let scored = postings.flatMap((posting) => {
		if (filters.when.length > 0) {
			let available = filters.when.some((when) =>
				when === 'term' ? posting.duringTerm : posting.duringBreak,
			)
			if (!available) return []
		}
		if (filters.offCampus !== undefined && posting.offCampus !== filters.offCampus) return []
		if (filters.postedSince && posting.postedAt.slice(0, 10) < filters.postedSince) return []

		let title = searchWords(posting.title)
		let body = searchWords(
			[
				...posting.description.fields.map((field) => field.value),
				posting.description.markdown,
			].join(' '),
		)
		if (!startsAll(filters.title, title)) return []
		if (!startsAll(filters.q, [...title, ...body])) return []

		let score = 5 * starts(words, title) + starts(words, body)
		let {description: _, ...listed} = posting
		return [{listed, score}]
	})

	let newest = (a: CarletonPosting, b: CarletonPosting) => b.postedAt.localeCompare(a.postedAt)
	return scored
		.sort((a, b) =>
			filters.sort === 'relevance' && a.score !== b.score
				? b.score - a.score
				: newest(a.listed, b.listed),
		)
		.map(({listed}) => listed)
}

async function board(env: Env) {
	try {
		return await fetchSource(env, carletonStudentWork, {})
	} catch (err) {
		console.warn('student-work: could not read Carleton Student Employment', String(err))
		return undefined
	}
}

const unavailable = () =>
	json({message: 'Carleton Student Employment could not be read'}, 502, ONE_MINUTE)

/// `/student-work/postings` at Carleton: the jobs, narrowed by the query.
export async function carletonPostings(env: Env, params: URLSearchParams) {
	let filters = parseCarletonFilters(params)
	if (typeof filters === 'string') return json({message: filters}, 400)
	let served = await board(env)
	if (!served) return unavailable()
	let postings = filterCarleton(served.value, filters)
	return json(
		{updatedAt: new Date(served.fetchedAt).toISOString(), count: postings.length, postings},
		200,
		ONE_HOUR,
	)
}

/// `/student-work/postings/:id` at Carleton: one job, with its description.
export async function carletonPosting(env: Env, id: string) {
	let served = await board(env)
	if (!served) return unavailable()
	let posting = served.value.find((candidate) => candidate.id === id)
	if (!posting) return json({message: 'no such posting on the board'}, 404, ONE_MINUTE)
	return json(posting, 200, ONE_HOUR)
}
