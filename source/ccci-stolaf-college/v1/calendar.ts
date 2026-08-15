import {googleCalendar} from '../../calendar/google.ts'
import {ical} from '../../calendar/ical.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {deprecatedEvents} from './deprecated.ts'
import type {Context} from '../../ccc-server/context.ts'

export const getGoogleCalendar = googleCalendar
export const getInternetCalendar = ical

export async function google(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)
	if (ctx.cached(ONE_MINUTE)) return

	let calendarId = ctx.URL.searchParams.get('id')
	ctx.assert(calendarId, 400, '?id is required')
	ctx.body = await getGoogleCalendar(calendarId)
}

export async function ics(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)
	if (ctx.cached(ONE_MINUTE)) return

	let calendarUrl = ctx.URL.searchParams.get('url')
	ctx.assert(calendarUrl, 400, '?id is required')
	ctx.body = await getInternetCalendar(new URL(calendarUrl))
}

/// The imported Google calendar behind this route was deleted upstream. The app
/// reads The Events Calendar directly now.
export function stolaf(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)
	if (ctx.cached(ONE_MINUTE)) return

	ctx.body = deprecatedEvents(
		'The calendar now loads inside the app. See the linked discussion for details.',
	)
}

export async function northfield(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)
	if (ctx.cached(ONE_MINUTE)) return

	ctx.body = await getGoogleCalendar('thisisnorthfield@gmail.com')
}

export async function krlx(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)
	if (ctx.cached(ONE_MINUTE)) return

	ctx.body = await getGoogleCalendar('krlxradio88.1@gmail.com')
}

export async function ksto(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)
	if (ctx.cached(ONE_MINUTE)) return

	ctx.body = await getGoogleCalendar(
		'stolaf.edu_7u3lgo4rr3o9dchr50q982ribk@group.calendar.google.com',
	)
}
