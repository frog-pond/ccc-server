import {googleCalendar} from '../../calendar/google.ts'
import {ical} from '../../calendar/ical.ts'
import {deprecatedEvents} from '../../calendar/deprecated.ts'
import {UNAVAILABLE_TITLE} from '../../ccc-lib/deprecated.ts'
import {requireQuery} from '../../ccc-worker/query.ts'
import type {Context} from '../../ccc-worker/env.ts'

export const getGoogleCalendar = googleCalendar
export const getInternetCalendar = ical

export async function google(c: Context) {
	let calendarId = requireQuery(c, 'id')
	return c.json(await getGoogleCalendar(calendarId, c.env.GOOGLE_CALENDAR_API_KEY))
}

export async function ics(c: Context) {
	let calendarUrl = requireQuery(c, 'url')
	return c.json(await getInternetCalendar(new URL(calendarUrl)))
}

/// The imported Google calendar behind this route was deleted upstream. The app
/// reads The Events Calendar directly now.
export function stolaf(c: Context) {
	return c.json(
		deprecatedEvents(
			UNAVAILABLE_TITLE,
			"The calendar can't be loaded right now. Open this event for details.",
		),
	)
}

export async function northfield(c: Context) {
	return c.json(
		await getGoogleCalendar('thisisnorthfield@gmail.com', c.env.GOOGLE_CALENDAR_API_KEY),
	)
}

export async function krlx(c: Context) {
	return c.json(await getGoogleCalendar('krlxradio88.1@gmail.com', c.env.GOOGLE_CALENDAR_API_KEY))
}

export async function ksto(c: Context) {
	return c.json(
		await getGoogleCalendar(
			'stolaf.edu_7u3lgo4rr3o9dchr50q982ribk@group.calendar.google.com',
			c.env.GOOGLE_CALENDAR_API_KEY,
		),
	)
}
