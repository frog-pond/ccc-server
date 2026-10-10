import {groupUnits, listedUnitsOf, OTHER_UNIT} from '../../source/student-work/areas.ts'
import {jobPageUrl} from '../../source/student-work/oracle-shape.ts'
import {
	displayTitle,
	LEVELS,
	payCode,
	searchWords,
	term,
	type Description,
	type Level,
	type PayCode,
	type Term,
} from '../../source/student-work/posting-shape.ts'
import {fetchSource} from './client.ts'
import {defineSource} from './define-source.ts'
import {registerSource} from './registry.ts'
import {pagesJson} from './sources/pages-json.ts'
import type {StoredPosting} from './student-work-do.ts'

const ONE_HOUR = 60 * 60
const ONE_MINUTE = 60

const json = (body: unknown, status = 200, cacheSeconds?: number) =>
	Response.json(body, {
		status,
		...(cacheSeconds === undefined
			? {}
			: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
	})

const failed = (err: unknown) =>
	json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)

export type StudentWork = {
	/// the published areas file, which says which units each area holds
	areasUrl: string
}

/// One posting as the routes answer it: the board's listing, what its title
/// says, and what its detail says once read.
export type Posting = {
	id: string
	title: string
	/// the title without its term prefix or pay code
	displayTitle: string
	/// the page a student reads and applies on
	url: string
	/// YYYY-MM-DD, as Oracle publishes it, with no zone
	postedDate: string
	postedAt: string | null
	endsAt: string | null
	/// when this server first saw it on the board
	firstSeenAt: string
	location: string | null
	category: string | null
	schedule: string | null
	requisitionType: string | null
	workplaceType: string | null
	term: Term | null
	level: Level | null
	payCode: PayCode | null
	/// the five-digit unit its description names; null when it names none or
	/// has not been read yet
	unit: string | null
	/// the slugs of the areas it belongs to; empty until its detail is read
	areas: string[]
	department: string | null
	wage: string | null
	length: string | null
	contact: string | null
	classification: string | null
	/// when its detail was last read, or null if never
	detailUpdatedAt: string | null
}

export type PostingWithDescription = Posting & {
	description: (Description & {html: string}) | null
}

interface Area {
	slug: string
	units: string[]
}

/// The published areas file, read as pages-json reads it, and kept only when
/// it is the shape the app publishes, so a file that is not one leaves the
/// last good copy in place.
export const studentWorkAreas = defineSource({
	name: 'student-work-areas',
	key: ({url}: {url: string}) => url,
	async load(params, env) {
		let body = await pagesJson.load(params, env)
		let data = (body as {data?: unknown} | null)?.data
		let listed = listedUnitsOf(body)
		if (!Array.isArray(data) || !listed) {
			throw new Error('the Student Work areas file is not a list of areas')
		}
		let areas = data.flatMap((entry: unknown) => {
			let {slug, units} = (entry ?? {}) as {slug?: unknown; units?: unknown}
			return typeof slug === 'string' && Array.isArray(units)
				? [{slug, units: units.filter((unit): unit is string => typeof unit === 'string')}]
				: []
		})
		return {areas, listed: [...listed]}
	},
	ttl: pagesJson.ttl,
	staleIfError: pagesJson.staleIfError,
})
registerSource(studentWorkAreas)

/// The areas, or undefined when the file cannot be read.
async function readAreas(
	env: Env,
	url: string,
): Promise<{areas: Area[]; listed: string[]} | undefined> {
	try {
		return (await fetchSource(env, studentWorkAreas, {url})).value
	} catch (err) {
		console.warn('student-work: could not read the areas file', String(err))
		return undefined
	}
}

/// The areas a posting belongs to, as the app sorts them: those listing its
/// unit, or the catch-all area's when none lists it or it has none.
function areasOf(stored: StoredPosting, areas: Area[]): string[] {
	if (stored.detail === null) return []
	let listed = (unit: string) => areas.filter((area) => area.units.includes(unit))
	let own = stored.unit === null ? [] : listed(stored.unit)
	return (own.length > 0 ? own : listed(OTHER_UNIT)).map((area) => area.slug)
}

const iso = (ms: number) => new Date(ms).toISOString()

function toPosting(stored: StoredPosting, areas: Area[]): Posting {
	let {board, detail} = stored
	let code = payCode(board.title)
	let promoted = detail?.description.promoted ?? {}
	return {
		id: board.id,
		title: board.title,
		displayTitle: displayTitle(board.title),
		url: jobPageUrl(board.id),
		postedDate: board.postedDate,
		postedAt: detail?.postedAt ?? null,
		endsAt: detail?.endsAt ?? null,
		firstSeenAt: iso(stored.firstSeenAt),
		location: detail?.location ?? board.location,
		category: detail?.category ?? null,
		schedule: detail?.schedule ?? null,
		requisitionType: detail?.requisitionType ?? null,
		workplaceType: detail?.workplaceType ?? null,
		term: term(board.title),
		level: code ? LEVELS[code.tier] : null,
		payCode: code,
		unit: stored.unit,
		areas: areasOf(stored, areas),
		department: promoted.department ?? null,
		wage: promoted.wage ?? null,
		length: promoted.length ?? null,
		contact: promoted.contact ?? null,
		classification: promoted.classification ?? null,
		detailUpdatedAt: stored.detailFetchedAt === null ? null : iso(stored.detailFetchedAt),
	}
}

/// What a list can be narrowed by. Values of one key are alternatives; keys
/// narrow together.
type Filters = {
	area: string[]
	unit: string[]
	level: string[]
	term: string[]
	postedSince: string | undefined
	q: string[]
}

const NONE = 'none'
const MAX_VALUES = 20
const PATTERNS: Record<'area' | 'unit' | 'level' | 'term', RegExp> = {
	area: /^[a-z0-9-]{1,64}$/u,
	unit: /^(?:\d{5}|none)$/u,
	level: new RegExp(`^(?:${[...Object.values(LEVELS), NONE].join('|')})$`, 'u'),
	term: /^(?:academic-year|fall|spring|summer|none)$/u,
}
const DATE = /^\d{4}-\d{2}-\d{2}$/u
const MAX_QUERY = 100

/// The filters a request asks for, or the message for a 400.
export function parseFilters(params: URLSearchParams): Filters | string {
	let known = new Set(['area', 'unit', 'level', 'term', 'posted_since', 'q'])
	for (let key of params.keys()) {
		if (!known.has(key))
			return `unknown parameter ${key.slice(0, 40)}; use ${[...known].join(', ')}`
	}

	let filters: Filters = {area: [], unit: [], level: [], term: [], postedSince: undefined, q: []}
	for (let key of ['area', 'unit', 'level', 'term'] as const) {
		let values = params.getAll(key).flatMap((value) => value.split(','))
		if (values.length > MAX_VALUES) return `too many values for ${key}`
		let bad = values.find((value) => !PATTERNS[key].test(value))
		if (bad !== undefined) return `${key} cannot be ${JSON.stringify(bad.slice(0, 40))}`
		filters[key] = values
	}

	let since = params.getAll('posted_since')
	if (since.length > 1) return 'posted_since can be given once'
	if (since[0] !== undefined) {
		if (!DATE.test(since[0])) return 'posted_since must be YYYY-MM-DD'
		filters.postedSince = since[0]
	}

	let q = params.getAll('q')
	if (q.length > 1) return 'q can be given once'
	if (q[0] !== undefined) {
		if (q[0].length > MAX_QUERY) return `q must be at most ${String(MAX_QUERY)} characters`
		filters.q = searchWords(q[0])
	}
	return filters
}

const any = <T>(chosen: T[], test: (value: T) => boolean) =>
	chosen.length === 0 || chosen.some(test)

/// Whether a posting passes the filters. The search matches when every word
/// of it starts some word of the title a student sees.
export function matches(posting: Posting, filters: Filters): boolean {
	let titleWords = filters.q.length > 0 ? searchWords(posting.displayTitle) : []
	return (
		any(filters.area, (slug) => posting.areas.includes(slug)) &&
		any(filters.unit, (unit) =>
			// none: read, and naming no unit
			unit === NONE
				? posting.unit === null && posting.detailUpdatedAt !== null
				: posting.unit === unit,
		) &&
		any(filters.level, (level) =>
			level === NONE ? posting.level === null : posting.level === level,
		) &&
		any(filters.term, (t) => (t === NONE ? posting.term === null : posting.term === t)) &&
		(filters.postedSince === undefined || posting.postedDate >= filters.postedSince) &&
		filters.q.every((word) => titleWords.some((titleWord) => titleWord.startsWith(word)))
	)
}

const newestFirst = (a: Posting, b: Posting) =>
	b.postedDate.localeCompare(a.postedDate) || Number(b.id) - Number(a.id)

async function readBoard(env: Env) {
	let result = await env.STUDENT_WORK.getByName('stolaf').read()
	if (result.state === 'error') throw new Error(result.error)
	return result
}

/// `/student-work/postings`: the board, narrowed by the query, newest first.
export async function postings(env: Env, work: StudentWork, params: URLSearchParams) {
	let filters = parseFilters(params)
	if (typeof filters === 'string') return json({message: filters}, 400)
	try {
		let [board, areas] = await Promise.all([readBoard(env), readAreas(env, work.areasUrl)])
		if (filters.area.length > 0 && !areas) {
			return failed(new Error('the Student Work areas could not be read'))
		}
		let list = board.postings
			.map((stored) => toPosting(stored, areas?.areas ?? []))
			.filter((posting) => matches(posting, filters))
			.sort(newestFirst)
		return json(
			{updatedAt: iso(board.updatedAt), count: list.length, postings: list},
			200,
			ONE_HOUR,
		)
	} catch (err) {
		console.error(err)
		return failed(err)
	}
}

/// `/student-work/postings/:id`: one posting, with its description.
export async function posting(env: Env, work: StudentWork, id: string) {
	try {
		let [board, areas] = await Promise.all([readBoard(env), readAreas(env, work.areasUrl)])
		let stored = board.postings.find((candidate) => candidate.board.id === id)
		if (!stored) return json({message: 'no such posting on the board'}, 404, ONE_MINUTE)
		let {detail} = stored
		let body: PostingWithDescription = {
			...toPosting(stored, areas?.areas ?? []),
			description: detail && {...detail.description, html: detail.descriptionHtml},
		}
		return json(body, 200, ONE_HOUR)
	} catch (err) {
		console.error(err)
		return failed(err)
	}
}

/// `/student-work/units`: each posting's unit by id, as the Node server's
/// route answers it. A posting whose detail has not been read is left out.
export async function units(env: Env, work: StudentWork) {
	try {
		let [board, areas] = await Promise.all([readBoard(env), readAreas(env, work.areasUrl)])
		let read: Record<string, string | null> = {}
		for (let stored of board.postings) {
			if (stored.detail !== null) read[stored.board.id] = stored.unit
		}
		return json(groupUnits(read, areas && new Set(areas.listed)), 200, ONE_HOUR)
	} catch (err) {
		console.error(err)
		return failed(err)
	}
}
