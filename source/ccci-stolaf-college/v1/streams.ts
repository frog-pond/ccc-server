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

// How far back search looks, unless asked for a range, and how far ahead it
// looks for upcoming streams (as the `upcoming` route does).
const SEARCH_YEARS = 30
const SEARCH_AHEAD_MONTHS = 2

// A page is at most this many streams. Upstream has no limit of its own.
const MAX_COUNT = 200

// A whole number in a query string, in plain digits: `Number()` alone would
// also read a blank as 0, and `1e2`, `0x32` and `50.0` as whole numbers, each
// a different URL for the same page.
const wholeNumber = (min: number, max?: number) =>
	z
		.string()
		.trim()
		.regex(/^\d+$/, 'must be a whole number')
		.transform(Number)
		.pipe(
			z
				.number()
				.int()
				.min(min)
				.max(max ?? Number.MAX_SAFE_INTEGER),
		)

// Search by `query` (required: upstream answers a blank one with everything).
// `class` is which streams to look at; `dateFrom` and `dateTo` narrow or widen
// the range it looks in, which otherwise depends on the class. Results come a
// `count` at a time, starting at `offset`.
const SearchStreamsParamsSchema = z.object({
	query: z.string().trim().min(1),
	sort: z.enum(['ascending', 'descending']).default('descending'),
	class: z.enum(['archived', 'upcoming', 'all']).default('archived'),
	category: z.string().trim().min(1).optional(),
	dateFrom: z.iso.date().optional(),
	dateTo: z.iso.date().optional(),
	count: wholeNumber(1, MAX_COUNT).default(50),
	offset: wholeNumber(0).default(0),
})

const StOlafStreamsParamsSchema = z.object({
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
		dateFrom = moment().tz('America/Chicago').format('YYYY-MM-DD'),
		dateTo = moment().add(2, 'month').tz('America/Chicago').format('YYYY-MM-DD'),
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
/// request's own parameters and changes only the page, as a path-absolute URL
/// so it holds behind a proxy. `available` is how many results there are in
/// all. Pages step by `count` from the request's own `offset`, so `next`
/// reaches `last` even from an offset that isn't a whole number of pages in.
function pageLinks(page: {
	path: string
	search: URLSearchParams
	count: number
	offset: number
	available: number
}): string | undefined {
	const {count, offset, available} = page
	const to = (rel: string, at: number) => {
		const search = new URLSearchParams(page.search)
		search.set('count', String(count))
		search.set('offset', String(at))
		return `<${page.path}?${search.toString()}>; rel="${rel}"`
	}

	const links: string[] = []
	if (offset > 0) {
		// from past the end, back to the real last page and not another empty one
		const prev =
			offset >= available
				? Math.max(0, Math.floor((available - 1) / count) * count)
				: Math.max(0, offset - count)
		links.push(to('first', 0), to('prev', prev))
	}
	if (offset + count < available) {
		const last = offset + Math.floor((available - 1 - offset) / count) * count
		links.push(to('next', offset + count), to('last', last))
	}
	return links.length ? links.join(', ') : undefined
}

/// An ISO date moved by `amount` of `unit`, as the St. Olaf calendar day.
function shiftDate(date: string, amount: number, unit: 'month' | 'year') {
	return moment.tz(date, 'YYYY-MM-DD', 'America/Chicago').add(amount, unit).format('YYYY-MM-DD')
}

// ISO dates sort as text.
const earlier = (a: string, b: string) => (a < b ? a : b)
const later = (a: string, b: string) => (a > b ? a : b)

// Upstream answers a page at a time, so the default is newest-first: with
// ascending order a broad query would only ever show the oldest matches.
export async function search(ctx: Context) {
	// Checked before the cache is asked, so a bad request isn't counted as a
	// miss or made to fill an entry.
	const parsed = SearchStreamsParamsSchema.safeParse(
		Object.fromEntries(ctx.URL.searchParams.entries()),
	)
	if (!parsed.success) ctx.throw(400, z.prettifyError(parsed.error))
	const {query, sort, category, count, offset, class: streamClass, dateFrom, dateTo} = parsed.data

	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const today = moment().tz('America/Chicago')
	const ahead = today.clone().add(SEARCH_AHEAD_MONTHS, 'month')
	const lookback = today.clone().subtract(SEARCH_YEARS, 'year')
	const defaults = {
		archived: {from: lookback, to: today},
		upcoming: {from: today, to: ahead},
		all: {from: lookback, to: ahead},
	}[streamClass]
	const defaultFrom = defaults.from.format('YYYY-MM-DD')
	const defaultTo = defaults.to.format('YYYY-MM-DD')

	// An end the client left out is the class's default, moved out if it would
	// otherwise cut off the end they gave: someone looking from a date past
	// the default end means to look on from there.
	const from =
		dateFrom ??
		(dateTo ? earlier(defaultFrom, shiftDate(dateTo, -SEARCH_YEARS, 'year')) : defaultFrom)
	const to =
		dateTo ??
		(dateFrom ? later(defaultTo, shiftDate(dateFrom, SEARCH_AHEAD_MONTHS, 'month')) : defaultTo)
	if (from > to) ctx.throw(400, 'dateFrom must not be after dateTo')

	const params = StOlafStreamsParamsSchema.parse({
		class: streamClass === 'upcoming' ? 'current' : streamClass,
		date_from: from,
		date_to: to,
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
			: pageLinks({path: ctx.path, search: ctx.URL.searchParams, count, offset, available})
	if (link) ctx.set('Link', link)
	ctx.body = streams
}
