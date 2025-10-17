import {googleCalendar} from '../../calendar/google.ts'
import {ical} from '../../calendar/ical.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import type {Context} from '../../ccc-server/context.ts'

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

export async function stolaf(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let id = '5g91il39n0sv4c2bjdv1jrvcpq4ulm4r@import.calendar.google.com'
	ctx.body = await getGoogleCalendar(id)
}

export async function oleville(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)

	let id = 'opha089fhthpchc0pkdqinca44nl7svk@import.calendar.google.com'
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

	let id = 'stolaf.edu_7u3lgo4rr3o9dchr50q982ribk@group.calendar.google.com'
	ctx.body = await getGoogleCalendar(id)
}
