import {get} from '../ccc-lib/http.js'
import moment from 'moment'
import getUrls from 'get-urls'
import {JSDOM} from 'jsdom'
import InternetCalendar from 'ical.js'
import {EventSchema} from './types.js'
import {sortBy} from 'lodash-es'

function convertEvent(event: InternetCalendar.Event, now = moment()) {
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	let description = JSDOM.fragment(event.description ?? '').textContent?.trim() ?? ''

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

export async function ical(
	url: string | URL,
	{onlyFuture = true, maxEndDate}: {onlyFuture?: boolean; maxEndDate?: moment.Moment} = {},
	now = moment(),
) {
	let body = await get(url, {headers: {accept: 'text/calendar'}}).text()

	let comp = InternetCalendar.Component.fromString(body)
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
