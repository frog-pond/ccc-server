import {googleCalendar} from '../../calendar/google.js'
import {ical} from '../../calendar/ical.js'
import {ONE_MINUTE} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import moment from 'moment'
import type {Context} from '../../ccc-server/context.js'

export const getGoogleCalendar = mem(googleCalendar, {maxAge: ONE_MINUTE})
export const getInternetCalendar = mem(ical, {maxAge: ONE_MINUTE})

export async function google(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let calendarId = ctx.URL.searchParams.get('id')
	ctx.assert(calendarId, 400, '?id is required')
	ctx.body = await getGoogleCalendar(calendarId)
}

export async function ics(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let calendarUrl = ctx.URL.searchParams.get('url')
	ctx.assert(calendarUrl, 400, '?id is required')
	ctx.body = await getInternetCalendar(new URL(calendarUrl))
}

export async function carleton(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let url = 'https://www.carleton.edu/calendar/?loadFeed=calendar&stamp=1714843628'
	let maxEndDate = moment().add(1, 'month')
	ctx.body = await getInternetCalendar(url, {maxEndDate})
}

export async function cave(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let url = 'https://www.carleton.edu/student/orgs/cave/calendar/?loadFeed=calendar'
	let maxEndDate = moment().add(1, 'month')
	ctx.body = await getInternetCalendar(url, {maxEndDate})
}

export async function stolaf(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let id = '5g91il39n0sv4c2bjdv1jrvcpq4ulm4r@import.calendar.google.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function northfield(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'thisisnorthfield@gmail.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function krlx(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'krlxradio88.1@gmail.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function ksto(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'kstonarwhal@gmail.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function convos(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let url = 'https://www.carleton.edu/convocations/calendar/?loadFeed=calendar&stamp=1714843936'
	let maxEndDate = moment().add(1, 'month')
	ctx.body = await getInternetCalendar(url, {maxEndDate})
}

export async function sumo(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'https://www.carleton.edu/student/orgs/sumo/schedule/?loadFeed=calendar&stamp=1714840383'
	let maxEndDate = moment().add(1, 'month')
	ctx.body = await getInternetCalendar(url, {maxEndDate})
}
