import {getText} from '../ccc-lib/http.ts'
import moment from 'moment'
import getUrls from 'get-urls'
import {textFromHtml} from '../ccc-lib/dom.ts'
import InternetCalendar from 'ical.js'
import {EventSchema} from './types.ts'
import {sortBy} from 'lodash-es'
import {countedLoad} from '../ccc-lib/feed-metrics.ts'

function convertEvent(event: InternetCalendar.Event, now = moment()) {
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	let description = textFromHtml(event.description ?? '')

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

interface IcalOptions {
	onlyFuture?: boolean
	maxEndDate?: moment.Moment
}

export function ical(url: string | URL, options: IcalOptions = {}, now = moment()) {
	// by host alone: a private feed's path carries its token
	let feed = URL.parse(String(url))?.host ?? 'unknown'
	return countedLoad('ical', feed, () => loadIcal(url, options, now))
}

async function loadIcal(
	url: string | URL,
	{onlyFuture = true, maxEndDate}: IcalOptions,
	now: moment.Moment,
) {
	let body = await getText(url, {headers: {accept: 'text/calendar'}})

	let comp = parseCalendar(body, url)
	let events = comp
		.getAllSubcomponents('vevent')
		.map((vevent) => new InternetCalendar.Event(vevent))

	if (onlyFuture) {
		events = events.filter((event) => moment(event.endDate.toString()).isAfter(now))
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
