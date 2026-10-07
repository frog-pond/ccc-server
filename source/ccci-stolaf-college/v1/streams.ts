import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import moment from 'moment-timezone'
import type {Context} from '../../ccc-server/context.ts'
import {z} from 'zod'

const StreamEntry = z.object({
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

const StreamEntryCollection = z.object({
	results: StreamEntry.array(),
	// how many streams match in all, not only on this page
	meta: z.object({available: z.number()}).optional(),
})

const GetStreamsParamsSchema = z.object({
	dateFrom: z.iso.date().optional(),
	dateTo: z.iso.date().optional(),
	sort: z.enum(['ascending', 'descending']).default('ascending'),
})

// How far ahead the upcoming streams reach, for the `upcoming` route and for
// searching them.
const UPCOMING_MONTHS = 2

const chicagoToday = () => moment().tz('America/Chicago')

// A page is at most this many streams. Upstream has no limit of its own.
const MAX_COUNT = 200

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
const SearchStreamsParamsSchema = z
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

const StOlafStreamsParamsSchema = z.object({
	// upstream searches without limit when it is given no dates
	date_from: z.iso.date().optional(),
	date_to: z.iso.date().optional(),
	sort: z.enum(['ascending', 'descending']),
	// `current` is upstream's word for upcoming
	class: z.enum(['current', 'archived', 'all']),
	squery: z.string().optional(),
	category: z.string().optional(),
	count: z.number().optional(),
	offset: z.number().optional(),
})
type StOlafStreamsParamsType = z.infer<typeof StOlafStreamsParamsSchema>

const getStreams = async (params: StOlafStreamsParamsType) => {
	const url = 'https://www.stolaf.edu/multimedia/api/collection'
	const response = await getJson(url, {searchParams: params})
	const json = (await response) as Promise<(z.infer<typeof StreamEntry> & {starttime: string})[]>
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

export async function upcoming(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const {
		dateFrom = chicagoToday().format('YYYY-MM-DD'),
		dateTo = chicagoToday().add(UPCOMING_MONTHS, 'month').format('YYYY-MM-DD'),
		sort,
	} = GetStreamsParamsSchema.parse(Object.fromEntries(ctx.URL.searchParams.entries()))

	const params = StOlafStreamsParamsSchema.parse({
		class: 'current',
		date_from: dateFrom,
		date_to: dateTo,
		sort,
	})
	ctx.body = (await getStreams(params)).streams
}

export async function archived(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const {
		dateFrom = moment().subtract(2, 'month').tz('America/Chicago').format('YYYY-MM-DD'),
		dateTo = moment().tz('America/Chicago').format('YYYY-MM-DD'),
		sort,
	} = GetStreamsParamsSchema.parse(Object.fromEntries(ctx.URL.searchParams.entries()))

	const params = StOlafStreamsParamsSchema.parse({
		class: 'archived',
		date_from: dateFrom,
		date_to: dateTo,
		sort,
	})

	ctx.body = (await getStreams(params)).streams
}

/// The `Link` header (RFC 8288) for a page of results: `first` and `prev` when
/// it isn't the first, `next` and `last` when more follow. Each keeps the
/// request's own parameters, as it sent them, and changes only the page, as a
/// path-absolute URL so it holds behind a proxy. `available` is how many
/// results there are in all. Pages step by `count` from the request's own
/// `offset`, so `next` reaches `last` even from an offset that isn't a whole
/// number of pages in; `prev` is the `count` before it, or all there is
/// before it when that is fewer, so it never repeats the current page.
function pageLinks(page: {
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
function shiftMonths(date: string, months: number) {
	return moment.tz(date, 'YYYY-MM-DD', 'America/Chicago').add(months, 'month').format('YYYY-MM-DD')
}

// ISO dates sort as text.
const earlier = (a: string, b: string) => (a < b ? a : b)
const later = (a: string, b: string) => (a > b ? a : b)

/// The range to search upcoming streams in: what the client gave, and for an
/// end it left out, today or UPCOMING_MONTHS ahead, moved out if that would
/// cut off the end it gave (someone looking from a date past the usual end
/// means to look on from there).
function upcomingRange(dateFrom: string | undefined, dateTo: string | undefined) {
	const today = chicagoToday().format('YYYY-MM-DD')
	const ahead = shiftMonths(today, UPCOMING_MONTHS)
	return {
		from: dateFrom ?? (dateTo ? earlier(today, dateTo) : today),
		to: dateTo ?? (dateFrom ? later(ahead, shiftMonths(dateFrom, UPCOMING_MONTHS)) : ahead),
	}
}

// Upstream answers a page at a time, so what has happened is newest first: with
// ascending order a broad query would only ever show the oldest matches.
export async function search(ctx: Context) {
	// Checked before the cache is asked, so a bad request isn't counted as a
	// miss or made to fill an entry.
	const parsed = SearchStreamsParamsSchema.safeParse(
		Object.fromEntries(ctx.URL.searchParams.entries()),
	)
	if (!parsed.success) ctx.throw(400, z.prettifyError(parsed.error))
	const {query, category, count, offset, class: streamClass, dateFrom, dateTo} = parsed.data
	const sort = parsed.data.sort ?? (streamClass === 'upcoming' ? 'ascending' : 'descending')

	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	// Archived streams and all streams are searched without limit unless the
	// client gives a date; upstream takes either end alone.
	const range =
		streamClass === 'upcoming' ? upcomingRange(dateFrom, dateTo) : {from: dateFrom, to: dateTo}

	const params = StOlafStreamsParamsSchema.parse({
		class: streamClass === 'upcoming' ? 'current' : streamClass,
		...(range.from && {date_from: range.from}),
		...(range.to && {date_to: range.to}),
		sort,
		squery: query,
		...(category && {category}),
		count,
		offset,
	})
	const {streams, available} = await getStreams(params)

	// Without a total from upstream there is nothing to say about other pages.
	const link =
		available === undefined
			? undefined
			: pageLinks({path: ctx.path, querystring: ctx.querystring, count, offset, available})
	if (link) ctx.set('Link', link)
	ctx.body = streams
}
