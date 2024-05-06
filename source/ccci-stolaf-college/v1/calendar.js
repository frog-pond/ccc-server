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

	let id = '5g91il39n0sv4c2bjdv1jrvcpq4ulm4r@import.calendar.google.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function oleville(ctx) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'opha089fhthpchc0pkdqinca44nl7svk@import.calendar.google.com'
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

	let id = 'stolaf.edu_7u3lgo4rr3o9dchr50q982ribk@group.calendar.google.com'
	ctx.body = await getGoogleCalendar(id)
}
