import {googleCalendar} from '../../calendar/google.ts'
import {ical} from '../../calendar/ical.ts'
import {weeklySchedule} from '../../calendar/weekly-schedule.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {deprecatedEvents} from '../../calendar/deprecated.ts'
import {UNAVAILABLE_TITLE} from '../../ccc-lib/deprecated.ts'
import {GH_PAGES} from './gh-pages.ts'
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
		UNAVAILABLE_TITLE,
		"The calendar can't be loaded right now. Open this event for details.",
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

/// KSTO's Google Calendar stopped at spring 2019. The station's current
/// schedule lives in its Now Playing post, which AAO-React-Native scrapes and
/// publishes each week.
export async function ksto(ctx: Context) {
	ctx.cacheControl(ONE_MINUTE)
	if (ctx.cached(ONE_MINUTE)) return

	ctx.body = await weeklySchedule(GH_PAGES('ksto-schedule.json').href)
}
