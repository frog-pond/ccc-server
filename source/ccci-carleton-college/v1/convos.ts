import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'
import {EventSchema} from '../../calendar/types.js'
import {CARLETON_UPCOMING_CONVOCATIONS_URL, getInternetCalendar} from './calendar.js'
import {
	ConvocationEpisodeSchema,
	fetchArchived,
	fetchUpcomingDetail,
	UpcomingConvocationEventSchema,
} from '../../carleton-edu/convocation.js'

export const getConvocationDetail = createRouteSpec({
	method: 'get',
	path: '/convos/upcoming/:id',
	validate: {
		params: z.object({id: z.string()}),
		response: UpcomingConvocationEventSchema,
	},
	handler: async (ctx) => {
		ctx.body = await fetchUpcomingDetail(ctx.request.params.id)
	},
})

export const getArchivedConvocations = createRouteSpec({
	method: 'get',
	path: '/convos/archived',
	validate: {response: ConvocationEpisodeSchema.array()},
	handler: async (ctx) => {
		ctx.body = await fetchArchived()
	},
})

export const getUpcomingConvocations = createRouteSpec({
	method: 'get',
	path: '/convos/upcoming',
	validate: {response: EventSchema.array()},
	handler: async (ctx) => {
		ctx.body = await getInternetCalendar(CARLETON_UPCOMING_CONVOCATIONS_URL)
	},
})
