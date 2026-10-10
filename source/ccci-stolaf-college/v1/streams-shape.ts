import moment from 'moment-timezone'
import {z} from 'zod'

export const StreamEntry = z.object({
	starttime: z.string(),
	location: z.string(),
	eid: z.unknown(),
	performer: z.string(),
	subtitle: z.string(),
	poster: z.url(),
	player: z.url(),
	status: z.string(),
	category: z.string(),
	hptitle: z.string(),
	category_textcolor: z.string(),
	category_color: z.string(),
	thumb: z.url(),
	title: z.string(),
	iframesrc: z.url(),
})

export const StreamEntryCollection = z.object({
	results: StreamEntry.array(),
	// how many streams match in all, not only on this page
	meta: z.object({available: z.number()}).optional(),
})

export const GetStreamsParamsSchema = z.object({
	dateFrom: z.iso.date().optional(),
	dateTo: z.iso.date().optional(),
	sort: z.enum(['ascending', 'descending']).default('ascending'),
})

// How far ahead the upcoming streams reach, for the `upcoming` route and for
// searching them.
export const UPCOMING_MONTHS = 2

export const chicagoToday = (now: Date = new Date()) => moment(now).tz('America/Chicago')

// A page is at most this many streams. Upstream has no limit of its own.
export const MAX_COUNT = 200

// A whole number in a query string, in plain digits with no padding: `Number()`
// alone would read a blank as 0, and `1e2`, `0x32`, `50.0` and `050` as whole
// numbers, each a different URL for the same page.
const wholeNumber = (min: number, max = Number.MAX_SAFE_INTEGER) =>
	z
		.string()
		.regex(/^(0|[1-9]\d*)$/, 'must be a whole number')
		.transform(Number)
		.pipe(z.number().int().min(min).max(max))

// Search by `query` (required: upstream answers a blank one with everything).
// `class` is which streams to look at; `dateFrom` and `dateTo` limit the range
// it looks in. Without them, archived streams and all streams are searched
// without limit, and upcoming streams cover the next UPCOMING_MONTHS. Results
// come a `count` at a time, starting at `offset`. `sort` is newest first for
// what has happened and soonest first for what is to come.
export const SearchStreamsParamsSchema = z
	.object({
		query: z.string().trim().min(1),
		sort: z.enum(['ascending', 'descending']).optional(),
		class: z.enum(['archived', 'upcoming', 'all']).default('archived'),
		category: z.string().trim().min(1).optional(),
		dateFrom: z.iso.date().optional(),
		dateTo: z.iso.date().optional(),
		count: wholeNumber(1, MAX_COUNT).default(50),
		offset: wholeNumber(0).default(0),
	})
	// Only a range the client gave in full can be reversed: an end it left out
	// is chosen to follow the one it gave. Checked here, before the cache is
	// asked, like the rest.
	.refine((p) => !p.dateFrom || !p.dateTo || p.dateFrom <= p.dateTo, {
		message: 'dateFrom must not be after dateTo',
		path: ['dateFrom'],
	})

export const StOlafStreamsParamsSchema = z.object({
	date_from: z.iso.date(),
	date_to: z.iso.date(),
	sort: z.enum(['ascending', 'descending']),
	// `current` is upstream's word for upcoming
	class: z.enum(['current', 'archived', 'all']),
	squery: z.string().optional(),
	category: z.string().optional(),
	count: z.number().optional(),
	offset: z.number().optional(),
})

// Search alone may leave out either date. Upstream then takes the one given, or
// none, and searches without limit on the end that is missing (checked against
// the live API: a lone date_from, a lone date_to or neither each answer 200
// with the right matches, in well under a second for a broad term).
export const StOlafSearchParamsSchema = StOlafStreamsParamsSchema.partial({
	date_from: true,
	date_to: true,
})
export type StOlafParamsType = z.infer<typeof StOlafSearchParamsSchema>

/// The streams in one of upstream's answers, each start as an ISO instant,
/// and how many match in all when upstream says.
export function streamsFrom(json: unknown) {
	const data = StreamEntryCollection.parse(json)

	const streams = data.results.map((stream) => {
		let {starttime} = stream
		return {
			...stream,
			starttime: moment.tz(starttime, 'YYYY-MM-DD HH:mm', 'America/Chicago').toISOString(),
		}
	})
	return {streams, available: data.meta?.available}
}

/// The `Link` header (RFC 8288) for a page of results: `first` and `prev` when
/// it isn't the first, `next` and `last` when more follow. Each keeps the
/// request's own parameters, as it sent them, and changes only the page, as a
/// path-absolute URL so it holds behind a proxy. `available` is how many
/// results there are in all. Pages step by `count` from the request's own
/// `offset`, so `next` reaches `last` even from an offset that isn't a whole
/// number of pages in; `prev` is the `count` before it, or all there is
/// before it when that is fewer, so it never repeats the current page.
export function pageLinks(page: {
	path: string
	querystring: string
	count: number
	offset: number
	available: number
}): string | undefined {
	const {count, offset, available} = page
	const kept = page.querystring
		.split('&')
		.filter((pair) => pair && !/^(count|offset)(=|$)/.test(pair))
		// a raw query string could hold what a header value or link can't
		.map((pair) => pair.replace(/[^\x21-\x7e]|[<>"]/g, encodeURIComponent))
	const to = (rel: string, at: number, size = count) =>
		`<${page.path}?${[...kept, `count=${String(size)}`, `offset=${String(at)}`].join('&')}>; rel="${rel}"`

	const links: string[] = []
	if (offset > 0) {
		links.push(to('first', 0))
		if (offset >= available) {
			// from past the end, back to the real last page and not another empty one
			links.push(to('prev', Math.max(0, Math.floor((available - 1) / count) * count)))
		} else if (offset < count) {
			links.push(to('prev', 0, offset))
		} else {
			links.push(to('prev', offset - count))
		}
	}
	if (offset + count < available) {
		const last = offset + Math.floor((available - 1 - offset) / count) * count
		links.push(to('next', offset + count), to('last', last))
	}
	return links.length ? links.join(', ') : undefined
}

/// An ISO date moved by `months`, as the St. Olaf calendar day.
export function shiftMonths(date: string, months: number) {
	return moment.tz(date, 'YYYY-MM-DD', 'America/Chicago').add(months, 'month').format('YYYY-MM-DD')
}

/// Today and UPCOMING_MONTHS ahead, as ISO dates: the usual window for upcoming
/// streams, for the `upcoming` route and for searching them.
export function upcomingWindow(now: Date = new Date()) {
	const from = chicagoToday(now).format('YYYY-MM-DD')
	return {from, to: shiftMonths(from, UPCOMING_MONTHS)}
}

// ISO dates sort as text.
const earlier = (a: string, b: string) => (a < b ? a : b)
const later = (a: string, b: string) => (a > b ? a : b)

/// The range to search upcoming streams in: what the client gave, and for an
/// end it left out, the end of the usual window, moved out if that would cut
/// off the end it gave (someone looking from a date past the usual end means to
/// look on from there). Only upcoming streams are in the range: a `dateTo`
/// before today leaves a range in the past, which upstream has no upcoming
/// streams in either way.
export function upcomingRange(
	dateFrom: string | undefined,
	dateTo: string | undefined,
	now: Date = new Date(),
) {
	const usual = upcomingWindow(now)
	return {
		from: dateFrom ?? (dateTo ? earlier(usual.from, dateTo) : usual.from),
		to: dateTo ?? (dateFrom ? later(usual.to, shiftMonths(dateFrom, UPCOMING_MONTHS)) : usual.to),
	}
}

/// The query upstream is asked for the `archived` and `upcoming` routes, from
/// the request's own parameters, as of `now`.
export function listParams(
	which: 'archived' | 'upcoming',
	query: Record<string, string>,
	now: Date = new Date(),
): StOlafParamsType {
	const window =
		which === 'upcoming'
			? upcomingWindow(now)
			: {
					from: moment(now).subtract(2, 'month').tz('America/Chicago').format('YYYY-MM-DD'),
					to: moment(now).tz('America/Chicago').format('YYYY-MM-DD'),
				}
	const {dateFrom = window.from, dateTo = window.to, sort} = GetStreamsParamsSchema.parse(query)
	return StOlafStreamsParamsSchema.parse({
		class: which === 'upcoming' ? 'current' : 'archived',
		date_from: dateFrom,
		date_to: dateTo,
		sort,
	})
}

/// The query upstream is asked for a search, from the request's own
/// parameters, as of `now`, with the page asked for; or why they are refused.
export function searchParams(query: Record<string, string>, now: Date = new Date()) {
	const parsed = SearchStreamsParamsSchema.safeParse(query)
	if (!parsed.success) return {error: z.prettifyError(parsed.error)} as const
	const {query: squery, category, count, offset, class: streamClass, dateFrom, dateTo} = parsed.data
	const sort = parsed.data.sort ?? (streamClass === 'upcoming' ? 'ascending' : 'descending')

	// Archived streams and all streams are searched without limit unless the
	// client gives a date; upstream takes either end alone.
	const range =
		streamClass === 'upcoming' ? upcomingRange(dateFrom, dateTo, now) : {from: dateFrom, to: dateTo}

	const params = StOlafSearchParamsSchema.parse({
		class: streamClass === 'upcoming' ? 'current' : streamClass,
		...(range.from && {date_from: range.from}),
		...(range.to && {date_to: range.to}),
		sort,
		squery,
		...(category && {category}),
		count,
		offset,
	})
	return {params, count, offset} as const
}
