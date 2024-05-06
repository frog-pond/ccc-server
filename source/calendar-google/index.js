import {get} from '../ccc-lib/http.js'
import moment from 'moment'
import getUrls from 'get-urls'
import {JSDOM} from 'jsdom'

function convertGoogleEvents(data, now = moment()) {
	let events = data.map((event) => {
		const startTime = moment(event.start.date || event.start.dateTime)
		const endTime = moment(event.end.date || event.end.dateTime)
		let description = (event.description || '').replace('<br>', '\n')
		description = JSDOM.fragment(description).textContent.trim()

		return {
			dataSource: 'google',
			startTime,
			endTime,
			title: event.summary || '',
			description: description,
			location: event.location || '',
			isOngoing: startTime.isBefore(now, 'day'),
			links: [...getUrls(description)],
			config: {
				startTime: true,
				endTime: true,
				subtitle: 'location',
			},
		}
	})

	return events
}

export async function googleCalendar(calendarId, now = moment()) {
	let calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`

	let params = {
		maxResults: 50,
		orderBy: 'startTime',
		showDeleted: false,
		singleEvents: true,
		timeMin: now.toISOString(),
		key: process.env.GOOGLE_CALENDAR_API_KEY,
	}

	let body = await get(calendarUrl, {searchParams: params}).json()

	return convertGoogleEvents(body.items)
}