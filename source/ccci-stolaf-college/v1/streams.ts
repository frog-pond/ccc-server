import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import moment from 'moment-timezone'
import type {Context} from '../../ccc-server/context.js'
import {z} from 'zod'
import mem from 'memoize'

const StreamEntry = z.object({
	starttime: z.string(),
	location: z.string(),
	eid: z.unknown(),
	performer: z.string(),
	subtitle: z.string(),
	poster: z.string().url(),
	player: z.string().url(),
	status: z.string(),
	category: z.string(),
	hptitle: z.string(),
	category_textcolor: z.string(),
	category_color: z.string(),
	thumb: z.string().url(),
	title: z.string(),
	iframesrc: z.string().url(),
})

const StreamEntryCollection = z.object({
	results: StreamEntry.array(),
})

const GetStreamsParamsSchema = z.object({
	dateFrom: z.string().date().optional(),
	dateTo: z.string().date().optional(),
	sort: z.enum(['ascending', 'descending']).default('ascending'),
})

type StOlafStreamsParamsType = z.infer<typeof StOlafStreamsParamsSchema>
const StOlafStreamsParamsSchema = z.object({
	date_from: z.string().date(),
	date_to: z.string().date(),
	sort: z.enum(['ascending', 'descending']),
	class: z.enum(['current', 'archived']),
})

const getStreams = mem(
	async (params: StOlafStreamsParamsType) => {
		const url = 'https://www.stolaf.edu/multimedia/api/collection'
		const response = await get(url, {searchParams: params})
		const json = (await response.clone().json()) as Promise<
			(z.infer<typeof StreamEntry> & {starttime: string})[]
		>
		const data = StreamEntryCollection.parse(json)

		return data.results.map((stream) => {
			let {starttime} = stream
			return {
				...stream,
				starttime: moment.tz(starttime, 'YYYY-MM-DD HH:mm', 'America/Chicago').toISOString(),
			}
		})
	},
	{maxAge: ONE_HOUR},
)

export async function upcoming(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	const {
		dateFrom = moment().tz('America/Chicago').format('YYYY-MM-DD'),
		dateTo = moment().add(2, 'month').tz('America/Chicago').format('YYYY-MM-DD'),
		sort,
	} = GetStreamsParamsSchema.parse(Object.fromEntries(ctx.URL.searchParams.entries()))

	ctx.body = await getStreams({
		class: 'current',
		date_from: dateFrom,
		date_to: dateTo,
		sort,
	})
}

export async function archived(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	const {
		dateFrom = moment().subtract(2, 'month').tz('America/Chicago').format('YYYY-MM-DD'),
		dateTo = moment().tz('America/Chicago').format('YYYY-MM-DD'),
		sort,
	} = GetStreamsParamsSchema.parse(Object.fromEntries(ctx.URL.searchParams.entries()))

	ctx.body = await getStreams({
		class: 'archived',
		date_from: dateFrom,
		date_to: dateTo,
		sort,
	})
}
