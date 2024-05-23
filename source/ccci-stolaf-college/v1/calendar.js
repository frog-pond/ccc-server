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

export async function stolaf(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'https://www.stolaf.edu/apps/calendar/ical.cfm'
	ctx.body = await getInternetCalendar(id)
}

export async function oleville(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id =
		'https://calendar.google.com/calendar/ical/opha089fhthpchc0pkdqinca44nl7svk%40import.calendar.google.com/public/basic.ics'
	ctx.body = await getInternetCalendar(id)
}

export async function thePause(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id =
		'https://calendar.google.com/calendar/ical/stolaf.edu_qkrej5rm8c8582dlnc28nreboc%40group.calendar.google.com/public/basic.ics'
	ctx.body = await getInternetCalendar(id)
}

export async function northfield(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id =
		'https://calendar.google.com/calendar/ical/thisisnorthfield%40gmail.com/public/basic.ics'
	ctx.body = await getInternetCalendar(id)
}

export async function krlx(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id =
		'https://calendar.google.com/calendar/ical/krlxradio88.1%40gmail.com/public/basic.ics'
	ctx.body = await getInternetCalendar(id)
}

export async function ksto(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id =
		'https://calendar.google.com/calendar/ical/stolaf.edu_7u3lgo4rr3o9dchr50q982ribk%40group.calendar.google.com/public/basic.ics'
	ctx.body = await getInternetCalendar(id)
}
