import {
	jobPageUrl,
	type BoardPosting,
	type OracleDetail,
} from '../../source/student-work/oracle-shape.ts'
import {
	displayTitle,
	LEVELS,
	payCode,
	readDescription,
	searchWords,
	term,
	type Description,
	type Level,
	type PayCode,
	type Term,
} from '../../source/student-work/posting-shape.ts'

/// One posting as the routes answer it: the board's listing, what its title
/// says, and what its detail says once read.
export interface Posting {
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

export type PostingDescription = Description & {html: string}

export type PostingWithDescription = Posting & {description: PostingDescription | null}

/// A posting's detail with its description read.
export type PostingDetail = OracleDetail & {description: Description}

export function postingDetail(detail: OracleDetail): PostingDetail {
	return {...detail, description: readDescription(detail.descriptionHtml)}
}

const iso = (ms: number) => new Date(ms).toISOString()

/// Everything about a posting but its areas, which depend on the areas file.
export type Listing = Omit<Posting, 'areas'>

export function listingOf(stored: {
	board: BoardPosting
	detail: PostingDetail | null
	unit: string | null
	firstSeenAt: number
	detailFetchedAt: number | null
}): Listing {
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
		department: promoted.department ?? null,
		wage: promoted.wage ?? null,
		length: promoted.length ?? null,
		contact: promoted.contact ?? null,
		classification: promoted.classification ?? null,
		detailUpdatedAt: stored.detailFetchedAt === null ? null : iso(stored.detailFetchedAt),
	}
}

/// What the full-text index holds for a posting: the words of the title a
/// student sees, and of its description and labelled lines, lowercased with
/// accents and apostrophes gone, as a search is.
export function searchText(listing: Listing, detail: PostingDetail | null) {
	let description = detail
		? [detail.description.markdown, ...detail.description.fields.map((field) => field.value)]
		: []
	return {
		title: searchWords(listing.displayTitle).join(' '),
		description: searchWords(description.join(' ')).join(' '),
	}
}

/// An FTS5 query matching every word as the start of a word, in the column
/// named or in any. Search words are letters and digits only, so quoting them
/// is enough.
export function ftsQuery(words: string[], column?: 'title'): string {
	let terms = words.map((word) => `"${word}"*`).join(' ')
	return column ? `${column} : (${terms})` : terms
}

/// What a list can be narrowed by. Values of one key are alternatives; keys
/// narrow together. `none` asks for postings that have no value there.
export interface Filters {
	area: string[]
	unit: string[]
	level: string[]
	term: string[]
	postedSince: string | undefined
	/// words that must each start a word of the title or description
	q: string[]
	/// words that must each start a word of the title a student sees
	title: string[]
	/// newest first, or best match first when searching
	sort: 'newest' | 'relevance'
}

export const NONE = 'none'
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
	let known = new Set(['area', 'unit', 'level', 'term', 'posted_since', 'q', 'title', 'sort'])
	for (let key of params.keys()) {
		if (!known.has(key)) {
			return `unknown parameter ${key.slice(0, 40)}; use ${[...known].join(', ')}`
		}
	}

	let filters: Filters = {
		area: [],
		unit: [],
		level: [],
		term: [],
		postedSince: undefined,
		q: [],
		title: [],
		sort: 'newest',
	}
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

	for (let key of ['q', 'title'] as const) {
		let text = params.getAll(key)
		if (text.length > 1) return `${key} can be given once`
		if (text[0] !== undefined) {
			if (text[0].length > MAX_QUERY) {
				return `${key} must be at most ${String(MAX_QUERY)} characters`
			}
			filters[key] = searchWords(text[0]).slice(0, MAX_VALUES)
		}
	}

	let sort = params.getAll('sort')
	if (sort.length > 1) return 'sort can be given once'
	if (sort[0] !== undefined) {
		if (sort[0] !== 'newest' && sort[0] !== 'relevance') return 'sort must be newest or relevance'
		filters.sort = sort[0]
	}
	return filters
}

/// Each area's units as [slug, unit] pairs, in the file's order.
export type AreaUnits = [slug: string, unit: string][]
