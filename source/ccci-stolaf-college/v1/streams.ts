import moment from 'moment-timezone'
import {getStreams, GetStreamsParamsSchema, StreamsResponseSchema} from '../../stolaf-edu/streaming.js'
import {createRouteSpec} from 'koa-zod-router'

export const getUpcomingRoute = createRouteSpec({
	method: 'get',
	path: '/streams/upcoming',
	validate: {
		query: GetStreamsParamsSchema,
		response: StreamsResponseSchema,
	},
	handler: async (ctx) => {
		const now = moment().tz('America/Chicago')
		ctx.body = await getStreams({
			class: 'current',
			date_from: ctx.request.query.dateFrom ?? now.format('YYYY-MM-DD'),
			date_to: ctx.request.query.dateTo ?? now.add(2, 'month').format('YYYY-MM-DD'),
			sort: ctx.request.query.sort,
		})
	},
})

export const getArchivedRoute = createRouteSpec({
	method: 'get',
	path: '/streams/archived',
	validate: {
		query: GetStreamsParamsSchema,
		response: StreamsResponseSchema,
	},
	handler: async (ctx) => {
		const now = moment().tz('America/Chicago')
		ctx.body = await getStreams({
			class: 'archived',
			date_from: ctx.request.query.dateFrom ?? now.subtract(2, 'month').format('YYYY-MM-DD'),
			date_to: ctx.request.query.dateTo ?? now.format('YYYY-MM-DD'),
			sort: ctx.request.query.sort,
		})
	},
})
