import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import moment from 'moment-timezone'
import type {Context} from '../../ccc-server/context.js'
import {z} from 'zod'

const StreamEntry = z.object({
	starttime: z.string().datetime(),
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

export async function getStreams(params: StOlafStreamsParamsType) {
	const url = 'https://www.stolaf.edu/multimedia/api/collection'
	const data = StreamEntryCollection.parse(await get(url, {searchParams: params}).json())

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
