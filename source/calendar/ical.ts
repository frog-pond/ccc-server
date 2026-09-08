import {getText} from '../ccc-lib/http.ts'
import moment from 'moment'
import getUrls from 'get-urls'
import {JSDOM} from 'jsdom'
import InternetCalendar from 'ical.js'
import {EventSchema} from './types.ts'
import {sortBy} from 'lodash-es'

function convertEvent(event: InternetCalendar.Event, now = moment()) {
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	let description = JSDOM.fragment(event.description ?? '').textContent.trim()

	return EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary ?? '',
		description: description,
		location: event.location ?? '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {
			uid: event.uid,
		},
		config: {
			startTime: true,
			endTime: true,
			subtitle: 'location',
		},
	})
}

/// A retired feed usually answers 200 with the site's HTML rather than a 404,
/// so the body is the only evidence that we got a calendar at all. Checking it
/// here turns that into one clear error naming the source, instead of a syntax
/// error from inside ical.js that reads as a fault in this server.
export function parseCalendar(body: string, source: string | URL) {
	let text = body.trim()

	if (!text.startsWith('BEGIN:VCALENDAR')) {
		throw new Error(`${String(source)} did not return a calendar`)
	}

	return InternetCalendar.Component.fromString(text)
}

export async function ical(
	url: string | URL,
	{onlyFuture = true, maxEndDate}: {onlyFuture?: boolean; maxEndDate?: moment.Moment} = {},
	now = moment(),
) {
	let body = await getText(url, {headers: {accept: 'text/calendar'}})

	let comp = parseCalendar(body, url)
	let events = comp
		.getAllSubcomponents('vevent')
		.map((vevent) => new InternetCalendar.Event(vevent))

	if (onlyFuture) {
		events = events.filter((event) => moment(event.endDate.toString()).isAfter(now, 'day'))
	}

	if (maxEndDate) {
		events = events.filter((event) =>
			moment(event.endDate.toString()).isSameOrBefore(maxEndDate, 'day'),
		)
	}

	return sortBy(
		events.map((e) => convertEvent(e, now)),
		(e) => e.startTime,
	)
}
