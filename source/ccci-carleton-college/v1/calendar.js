import {googleCalendar} from '../../calendar/google.js'
import {ical} from '../../calendar/ical.js'
import {ONE_MINUTE} from '../../ccc-lib/constants.js'
import mem from 'memoize'

export const getGoogleCalendar = mem(googleCalendar, {maxAge: ONE_MINUTE})
export const getInternetCalendar = mem(ical, {maxAge: ONE_MINUTE})

export async function google(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let {id: calendarId} = ctx.query
	ctx.body = await getGoogleCalendar(calendarId)
}

export async function ics(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let {url: calendarUrl} = ctx.query
	ctx.body = await getInternetCalendar(calendarUrl)
}

export async function carleton(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'https://www.carleton.edu/calendar/?loadFeed=calendar&stamp=1714843628'
	ctx.body = await getInternetCalendar(url)
}

export async function cave(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'https://www.carleton.edu/student/orgs/cave/calendar/?loadFeed=calendar'
	ctx.body = await getInternetCalendar(url)
}

export async function stolaf(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'https://www.stolaf.edu/apps/calendar/ical.cfm'
	ctx.body = await getInternetCalendar(id)
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
		'https://www.carleton.edu/convocations/calendar/?loadFeed=calendar&stamp=1714843936'
	ctx.body = await getInternetCalendar(url)
}

export async function sumo(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let url =
		'https://www.carleton.edu/student/orgs/sumo/schedule/?loadFeed=calendar&stamp=1714840383'
	ctx.body = await getInternetCalendar(url)
}
