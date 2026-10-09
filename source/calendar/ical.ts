import {getText} from '../ccc-lib/http.ts'
import moment from 'moment-timezone'
import getUrls from 'get-urls'
import {textFromHtml} from '../ccc-lib/dom.ts'
import InternetCalendar from 'ical.js'
import {EventSchema} from './types.ts'
import {sortBy} from 'lodash-es'

/// A zone moment knows by name, or nothing.
function knownZone(name: unknown): string | undefined {
	return typeof name === 'string' && moment.tz.zone(name) ? name : undefined
}

/// The instant an iCal time names. ical.js prints every time but a UTC one
/// without an offset, so parsing its string reads the time in the server's
/// own zone. Instead:
/// - a DATE is a calendar day, kept at UTC midnight, as the app expects;
/// - a time with a TZID is read in that zone;
/// - a floating time (no TZID, no Z) is read in the calendar's zone
///   (`X-WR-TIMEZONE`), which is how Carleton's feeds give every time.
/// A zone moment doesn't know (a Windows name, say) falls back to the
/// calendar's, then to UTC.
function instant(time: InternetCalendar.Time, calendarZone: string | undefined) {
	let wallClock = time.toString().replace(/Z$/u, '')
	if (time.isDate || time.zone.tzid === 'UTC') {
		return moment.utc(wallClock)
	}
	// a TZID with a VTIMEZONE in the feed is resolved into `zone`; one without
	// stays as the name in `timezone`
	let zone = knownZone(time.timezone) ?? knownZone(time.zone.tzid) ?? calendarZone
	return zone ? moment.tz(wallClock, zone) : moment.utc(wallClock)
}

function convertEvent(event: InternetCalendar.Event, calendarZone?: string, now = moment()) {
	const startTime = instant(event.startDate, calendarZone)
	const endTime = instant(event.endDate, calendarZone)
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

export async function ical(
	url: string | URL,
	{onlyFuture = true, maxEndDate}: {onlyFuture?: boolean; maxEndDate?: moment.Moment} = {},
	now = moment(),
) {
	let body = await getText(url, {headers: {accept: 'text/calendar'}})

	let comp = parseCalendar(body, url)
	let zone = knownZone(comp.getFirstPropertyValue('x-wr-timezone'))
	let events = comp
		.getAllSubcomponents('vevent')
		.map((vevent) => new InternetCalendar.Event(vevent))

	if (onlyFuture) {
		events = events.filter((event) => instant(event.endDate, zone).isAfter(now))
	}

	if (maxEndDate) {
		events = events.filter((event) =>
			instant(event.endDate, zone).isSameOrBefore(maxEndDate, 'day'),
		)
	}

	return sortBy(
		events.map((e) => convertEvent(e, zone, now)),
		(e) => e.startTime,
	)
}
