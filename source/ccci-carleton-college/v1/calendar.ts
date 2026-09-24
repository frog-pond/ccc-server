import {googleCalendar} from '../../calendar/google.ts'
import {ical} from '../../calendar/ical.ts'
import {deprecatedEvents} from '../../calendar/deprecated.ts'
import {RETIRED_TITLE} from '../../ccc-lib/deprecated.ts'
import {requireQuery} from '../../ccc-worker/query.ts'
import moment from 'moment'
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

export async function carleton(c: Context) {
	let url = 'https://www.carleton.edu/calendar/?loadFeed=calendar&stamp=1714843628'
	let maxEndDate = moment().add(1, 'month')
	return c.json(await getInternetCalendar(url, {maxEndDate}))
}

/// The Cave still runs, but its site moved to WordPress and took the calendar
/// feed with it: the old URL now answers 200 with a page, and the calendar it
/// replaced has been empty in every week we checked. The route stays and
/// answers with a notice, the way the retired St. Olaf sources do, because the
/// clients calling it cannot be changed.
export function cave(c: Context) {
	return c.json(deprecatedEvents(RETIRED_TITLE, 'The Cave calendar is no longer published.'))
}

/// The Google calendar this mirrored St. Olaf's events through was deleted —
/// the API answers 404 for it — and nothing republishes them to Carleton. St.
/// Olaf's own copy of this route already answers with a notice; this one was
/// left fetching a calendar that is gone.
export function stolaf(c: Context) {
	return c.json(
		deprecatedEvents(RETIRED_TITLE, 'St. Olaf events are no longer published to Carleton.'),
	)
}

export async function northfield(c: Context) {
	let id = 'thisisnorthfield@gmail.com'
	return c.json(await getGoogleCalendar(id, c.env.GOOGLE_CALENDAR_API_KEY))
}

export async function krlx(c: Context) {
	let id = 'krlxradio88.1@gmail.com'
	return c.json(await getGoogleCalendar(id, c.env.GOOGLE_CALENDAR_API_KEY))
}

export async function ksto(c: Context) {
	let id = 'kstonarwhal@gmail.com'
	return c.json(await getGoogleCalendar(id, c.env.GOOGLE_CALENDAR_API_KEY))
}

export async function convos(c: Context) {
	let url = 'https://www.carleton.edu/convocations/calendar/?loadFeed=calendar&stamp=1714843936'
	let maxEndDate = moment().add(1, 'month')
	return c.json(await getInternetCalendar(url, {maxEndDate}))
}

export async function sumo(c: Context) {
	let url =
		'https://www.carleton.edu/student/orgs/sumo/schedule/?loadFeed=calendar&stamp=1714840383'
	let maxEndDate = moment().add(1, 'month')
	return c.json(await getInternetCalendar(url, {maxEndDate}))
}
