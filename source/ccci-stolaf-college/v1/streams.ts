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

// Search takes only a query and a sort; its date range is fixed. A blank query
// is refused, since upstream would answer it with every archived stream.
const SearchStreamsParamsSchema = z.object({
	query: z.string().trim().min(1),
	sort: z.enum(['ascending', 'descending']).default('descending'),
})

// How far back search looks.
const SEARCH_YEARS = 30

const StOlafStreamsParamsSchema = z.object({
	date_from: z.iso.date(),
	date_to: z.iso.date(),
	sort: z.enum(['ascending', 'descending']),
	class: z.enum(['current', 'archived']),
	squery: z.string().optional(),
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

// Upstream answers with one page of 50, so the default is newest-first: with
// ascending order a broad query would only ever show the oldest matches.
export async function search(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const parsed = SearchStreamsParamsSchema.safeParse(
		Object.fromEntries(ctx.URL.searchParams.entries()),
	)
	if (!parsed.success) ctx.throw(400, 'query is required')
	const {query, sort} = parsed.data

	ctx.body = await getStreams({
		class: 'archived',
		date_from: moment().subtract(SEARCH_YEARS, 'year').tz('America/Chicago').format('YYYY-MM-DD'),
		date_to: moment().tz('America/Chicago').format('YYYY-MM-DD'),
		sort,
		squery: query,
	})
}
