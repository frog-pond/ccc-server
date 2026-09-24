import {getJson} from '../ccc-lib/http.ts'
import moment from 'moment'
import getUrls from 'get-urls'
import {textFromHtml} from '../ccc-lib/dom.ts'
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
		description = textFromHtml(description)

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

export async function googleCalendar(calendarId: string, apiKey: string, now = moment()) {
	let calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`

	let params = {
		maxResults: '50',
		orderBy: 'startTime',
		showDeleted: 'false',
		singleEvents: 'true',
		timeMin: now.toISOString(),
		key: apiKey,
	}

	let body = GoogleCalendarResultSchema.parse(await getJson(calendarUrl, {searchParams: params}))

	return convertGoogleEvents(body.items)
}
