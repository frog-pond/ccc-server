import {get} from '../ccc-lib/http.ts'
import moment from 'moment'
import getUrls from 'get-urls'
import {JSDOM} from 'jsdom'
import {EventSchema} from './types.ts'
import {z} from 'zod'

type GoogleCalendarEventType = z.infer<typeof GoogleCalendarEventSchema>
const GoogleCalendarEventSchema = z.object({
	start: z.object({
		date: z.string().date().optional(),
		dateTime: z.string().datetime({offset: true}).optional(),
	}),
	end: z.object({
		date: z.string().date().optional(),
		dateTime: z.string().datetime({offset: true}).optional(),
	}),
	description: z.string().optional(),
	summary: z.string().optional(),
	location: z.string().optional(),
})

const GoogleCalendarResultSchema = z.object({
	items: GoogleCalendarEventSchema.array(),
})

function convertGoogleEvents(data: GoogleCalendarEventType[], now = moment()) {
	return data.map((event) => {
		const startTime = moment(event.start.date ?? event.start.dateTime)
		const endTime = moment(event.end.date ?? event.end.dateTime)
		let description = (event.description ?? '').replace('<br>', '\n')
		description = JSDOM.fragment(description).textContent.trim()

		return EventSchema.parse({
			dataSource: 'google',
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			title: event.summary ?? '',
			description: description,
			location: event.location ?? '',
			isOngoing: startTime.isBefore(now, 'day'),
			links: [...getUrls(description)],
			config: {
				startTime: true,
				endTime: true,
				subtitle: 'location',
			},
		})
	})
}

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

	let body = GoogleCalendarResultSchema.parse(await get(calendarUrl, {searchParams: params}).json())

	return convertGoogleEvents(body.items)
}
