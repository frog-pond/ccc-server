import moment from 'moment-timezone'
import {z} from 'zod'
import {get} from '../ccc-lib/http.js'

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

export const GetStreamsParamsSchema = z.object({
	dateFrom: z.string().date().optional(),
	dateTo: z.string().date().optional(),
	sort: z.enum(['ascending', 'descending']).default('ascending'),
})

export type StOlafStreamsParamsType = z.infer<typeof StOlafStreamsParamsSchema>
export const StOlafStreamsParamsSchema = z.object({
	date_from: z.string().date(),
	date_to: z.string().date(),
	sort: z.enum(['ascending', 'descending']),
	class: z.enum(['current', 'archived']),
})

export type StreamsResponseType = z.infer<typeof StreamsResponseSchema>
export const StreamsResponseSchema = StreamEntry.array()

export async function getStreams(params: StOlafStreamsParamsType): Promise<StreamsResponseType> {
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
