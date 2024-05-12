import {googleCalendar} from '../../calendar/google.js'
import {ical} from '../../calendar/ical.js'
import {ONE_MINUTE} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'
import {EventSchema} from '../../calendar/types.js'

export const getGoogleCalendar = mem(googleCalendar, {maxAge: ONE_MINUTE})
export const getInternetCalendar = mem(ical, {maxAge: ONE_MINUTE})

export const getGoogleCalendarRoute = createRouteSpec({
	method: 'get',
	path: '/calendar/google',
	validate: {
		query: z.object({id: z.string()}),
		response: EventSchema.array(),
	},
	handler: async (ctx) => {
		ctx.body = await getGoogleCalendar(ctx.request.query.id)
	},
})

export const getInternetCalendarRoute = createRouteSpec({
	method: 'get',
	path: '/calendar/google',
	validate: {
		query: z.object({url: z.string().url()}),
		response: EventSchema.array(),
	},
	handler: async (ctx) => {
		ctx.body = await getInternetCalendar(ctx.request.query.url)
	},
})

const KnownCalendars = z.enum([
	'carleton',
	'the-cave',
	'stolaf',
	'northfield',
	'krlx-schedule',
	'ksto-schedule',
	'upcoming-convos',
	'sumo-schedule',
])

export const getKnownCalendarRoute = createRouteSpec({
	method: 'get',
	path: '/calendar/named/:calendar',
	validate: {
		params: z.object({calendar: KnownCalendars}),
		response: EventSchema.array(),
	},
	handler: async (ctx) => {
		switch (ctx.request.params.calendar) {
			case 'carleton':
				ctx.body = await getInternetCalendar('https://www.carleton.edu/calendar/?loadFeed=calendar')
				break
			case 'the-cave':
				ctx.body = await getInternetCalendar(
					'https://www.carleton.edu/student/orgs/cave/calendar/?loadFeed=calendar',
				)
				break
			case 'stolaf':
				ctx.body = await getGoogleCalendar(
					'5g91il39n0sv4c2bjdv1jrvcpq4ulm4r@import.calendar.google.com',
				)
				break
			case 'northfield':
				ctx.body = await getGoogleCalendar('thisisnorthfield@gmail.com')
				break
			case 'ksto-schedule':
				ctx.body = await getGoogleCalendar('kstonarwhal@gmail.com')
				break
			case 'krlx-schedule':
				ctx.body = await getGoogleCalendar('krlxradio88.1@gmail.com')
				break
			case 'upcoming-convos':
				ctx.body = await getInternetCalendar(
					'https://www.carleton.edu/convocations/calendar/?loadFeed=calendar',
				)
				break
			case 'sumo-schedule':
				ctx.body = await getInternetCalendar(
					'https://www.carleton.edu/student/orgs/sumo/schedule/?loadFeed=calendar',
				)
				break
		}
	},
})
