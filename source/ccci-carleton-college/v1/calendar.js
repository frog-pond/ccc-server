import {googleCalendar} from '../../calendar-google/index.js'
import {reasonCalendar} from '../../calendar-reason/index.js'
import {ONE_MINUTE} from '../../ccc-lib/constants.js'
import mem from 'memoize'

export const getGoogleCalendar = mem(googleCalendar, {maxAge: ONE_MINUTE})
export const getReasonCalendar = mem(reasonCalendar, {maxAge: ONE_MINUTE})

export async function google(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let {id: calendarId} = ctx.query
	ctx.body = await getGoogleCalendar(calendarId)
}

export async function reason(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let {url: calendarUrl} = ctx.query
	ctx.body = await getReasonCalendar(calendarUrl)
}

export function ics(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	ctx.throw(501, 'ICS support is not implemented yet.')
}

export async function carleton(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'webcal://www.carleton.edu/calendar/?loadFeed=calendar&stamp=1714843628'
	ctx.body = await getGoogleCalendar(url)
}

export async function cave(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'webcal://www.carleton.edu/student/orgs/cave/calendar/?loadFeed=calendar&stamp=1714844429\n'
	ctx.body = await getGoogleCalendar(url)
}

export async function stolaf(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id = '5g91il39n0sv4c2bjdv1jrvcpq4ulm4r@import.calendar.google.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function northfield(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'thisisnorthfield@gmail.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function krlx(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'krlxradio88.1@gmail.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function ksto(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'kstonarwhal@gmail.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function convos(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'webcal://www.carleton.edu/convocations/calendar/?loadFeed=calendar&stamp=1714843936'
	ctx.body = await getGoogleCalendar(url)
}

export async function sumo(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'webcal://www.carleton.edu/student/orgs/sumo/schedule/?loadFeed=calendar&stamp=1714840383'
	ctx.body = await getGoogleCalendar(url)
}
