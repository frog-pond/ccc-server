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

// Search by `query` (required: upstream answers a blank one with everything).
// `class` is which streams to look at; `dateFrom` and `dateTo` narrow or widen
// the range it looks in, which otherwise depends on the class. Results come a
// `count` at a time, starting at `offset`.
const SearchStreamsParamsSchema = z
	.object({
		query: z.string().trim().min(1),
		sort: z.enum(['ascending', 'descending']).default('descending'),
		class: z.enum(['archived', 'upcoming', 'all']).default('archived'),
		category: z.string().trim().min(1).optional(),
		dateFrom: z.iso.date().optional(),
		dateTo: z.iso.date().optional(),
		count: z.coerce.number().int().min(1).max(MAX_COUNT).default(50),
		offset: z.coerce.number().int().min(0).default(0),
	})
	.refine((p) => !p.dateFrom || !p.dateTo || p.dateFrom <= p.dateTo, {
		message: 'dateFrom must not be after dateTo',
		path: ['dateFrom'],
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

	return data.results.map((stream) => {
		let {starttime} = stream
		return {
			...stream,
			starttime: moment.tz(starttime, 'YYYY-MM-DD HH:mm', 'America/Chicago').toISOString(),
		}
	})
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
	ctx.body = await getStreams(params)
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

	ctx.body = await getStreams(params)
}

// Upstream answers a page at a time, so the default is newest-first: with
// ascending order a broad query would only ever show the oldest matches.
export async function search(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const parsed = SearchStreamsParamsSchema.safeParse(
		Object.fromEntries(ctx.URL.searchParams.entries()),
	)
	if (!parsed.success) ctx.throw(400, z.prettifyError(parsed.error))
	const {query, sort, category, count, offset, ...rest} = parsed.data

	const today = moment().tz('America/Chicago')
	const ahead = today.clone().add(SEARCH_AHEAD_MONTHS, 'month')
	const lookback = today.clone().subtract(SEARCH_YEARS, 'year')
	const defaults = {
		archived: {from: lookback, to: today},
		upcoming: {from: today, to: ahead},
		all: {from: lookback, to: ahead},
	}[rest.class]

	ctx.body = await getStreams({
		class: rest.class === 'upcoming' ? 'current' : rest.class,
		date_from: rest.dateFrom ?? defaults.from.format('YYYY-MM-DD'),
		date_to: rest.dateTo ?? defaults.to.format('YYYY-MM-DD'),
		sort,
		squery: query,
		...(category && {category}),
		count,
		offset,
	})
}
