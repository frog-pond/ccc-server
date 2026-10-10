import {getJson} from '../ccc-lib/http.ts'
import moment from 'moment'
import {eventsFromGoogle} from './google-shape.ts'

export {convertGoogleEvents} from './google-shape.ts'

export async function googleCalendar(calendarId: string, now = moment()) {
	let calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`

	let params = {
		maxResults: '50',
		orderBy: 'startTime',
		showDeleted: 'false',
		singleEvents: 'true',
		timeMin: now.toISOString(),
		key: process.env['GOOGLE_CALENDAR_API_KEY'] ?? '',
	}

	return eventsFromGoogle(await getJson(calendarUrl, {searchParams: params}), now)
}
