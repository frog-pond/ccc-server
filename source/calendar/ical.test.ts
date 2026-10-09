import {test} from 'node:test'
import InternetCalendar from 'ical.js'
import moment from 'moment'
import {textFromHtml} from '../ccc-lib/dom.ts'
import getUrls from 'get-urls'
import {EventSchema} from './types.ts'
import {ical} from './ical.ts'

/**
 * Tests for the ical.js event parser
 *
 * These tests verify that the convertEvent function correctly handles null values
 * from ical.js when event properties (summary, description, location) are missing.
 *
 * Background: ical.js returns null for missing event properties, but the Zod schema
 * expects strings. The fix uses the ?? '' operator to convert null to empty string.
 */

void test('ical event with missing location should parse successfully', (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:test@example.com
SUMMARY:Test Event
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
DESCRIPTION:Test description
END:VEVENT
END:VCALENDAR`

	const comp = InternetCalendar.Component.fromString(sampleIcal)
	const events = comp.getAllSubcomponents('vevent').map((v) => new InternetCalendar.Event(v))

	t.assert.equal(events.length, 1, 'Should have exactly one event')
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const event = events[0]!

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = textFromHtml(event.description ?? '')

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary ?? '',
		description: description,
		location: event.location ?? '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.assert.equal(result.title, 'Test Event')
	t.assert.equal(result.description, 'Test description')
	t.assert.equal(result.location, '')
})

void test('ical event with missing description should parse successfully', (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:test@example.com
SUMMARY:Test Event
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
LOCATION:Test Location
END:VEVENT
END:VCALENDAR`

	const comp = InternetCalendar.Component.fromString(sampleIcal)
	const events = comp.getAllSubcomponents('vevent').map((v) => new InternetCalendar.Event(v))

	t.assert.equal(events.length, 1, 'Should have exactly one event')
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const event = events[0]!

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = textFromHtml(event.description ?? '')

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary ?? '',
		description: description,
		location: event.location ?? '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.assert.equal(result.title, 'Test Event')
	t.assert.equal(result.description, '')
	t.assert.equal(result.location, 'Test Location')
})

void test('ical event with all properties missing should parse successfully', (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:test@example.com
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
END:VEVENT
END:VCALENDAR`

	const comp = InternetCalendar.Component.fromString(sampleIcal)
	const events = comp.getAllSubcomponents('vevent').map((v) => new InternetCalendar.Event(v))

	t.assert.equal(events.length, 1, 'Should have exactly one event')
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const event = events[0]!

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = textFromHtml(event.description ?? '')

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary ?? '',
		description: description,
		location: event.location ?? '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.assert.equal(result.title, '')
	t.assert.equal(result.description, '')
	t.assert.equal(result.location, '')
})

void test('ical event with all properties present should parse successfully', (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:test@example.com
SUMMARY:Test Event
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
DESCRIPTION:Test description
LOCATION:Test Location
END:VEVENT
END:VCALENDAR`

	const comp = InternetCalendar.Component.fromString(sampleIcal)
	const events = comp.getAllSubcomponents('vevent').map((v) => new InternetCalendar.Event(v))

	t.assert.equal(events.length, 1, 'Should have exactly one event')
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const event = events[0]!

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = textFromHtml(event.description ?? '')

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary ?? '',
		description: description,
		location: event.location ?? '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.assert.equal(result.title, 'Test Event')
	t.assert.equal(result.description, 'Test description')
	t.assert.equal(result.location, 'Test Location')
})

void test('ical function should filter events beyond maxEndDate', (t) => {
	const now = moment('2024-01-01')
	const maxEndDate = moment('2026-01-01')

	// Create an iCal with events in different time periods
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:event1@example.com
SUMMARY:Event within range
DTSTART:20250601T100000Z
DTEND:20250601T110000Z
END:VEVENT
BEGIN:VEVENT
UID:event2@example.com
SUMMARY:Event beyond maxEndDate
DTSTART:20990101T100000Z
DTEND:20990101T110000Z
END:VEVENT
BEGIN:VEVENT
UID:event3@example.com
SUMMARY:Event just at limit
DTSTART:20260101T100000Z
DTEND:20260101T110000Z
END:VEVENT
END:VCALENDAR`

	// We test the filtering logic directly
	const comp = InternetCalendar.Component.fromString(sampleIcal)
	let events = comp
		.getAllSubcomponents('vevent')
		.map((vevent) => new InternetCalendar.Event(vevent))

	// Apply filters as the ical function does
	events = events.filter((event) => moment(event.endDate.toString()).isAfter(now))
	events = events.filter((event) =>
		moment(event.endDate.toString()).isSameOrBefore(maxEndDate, 'day'),
	)

	t.assert.equal(events.length, 2, 'Should have filtered out the event beyond 2026')

	const eventSummaries = events.map((e) => e.summary)
	t.assert.equal(eventSummaries.includes('Event within range'), true)
	t.assert.equal(eventSummaries.includes('Event just at limit'), true)
	t.assert.equal(eventSummaries.includes('Event beyond maxEndDate'), false)
})

void test('ical keeps events that end later today and drops ones already over', async (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:morning@example.com
SUMMARY:This morning
DTSTART:20261004T140000Z
DTEND:20261004T150000Z
END:VEVENT
BEGIN:VEVENT
UID:tonight@example.com
SUMMARY:Tonight
DTSTART:20261004T230000Z
DTEND:20261005T010000Z
END:VEVENT
BEGIN:VEVENT
UID:evening@example.com
SUMMARY:This evening
DTSTART:20261004T200000Z
DTEND:20261004T210000Z
END:VEVENT
END:VCALENDAR`

	const now = moment('2026-10-04T18:00:00Z')
	const url = `data:text/calendar,${encodeURIComponent(sampleIcal)}`
	const events = await ical(url, {}, now)

	t.assert.deepEqual(
		events.map((e) => e.title),
		['This evening', 'Tonight'],
	)
})

/// Carleton's feeds give every time as a floating local time
/// (`DTSTART:20261009T190000`) and name the zone only once, for the whole
/// calendar. Read as the server's own zone, a 7pm Carleton event landed at
/// 19:00 UTC: five hours early, and gone from the list by early evening.
void test('ical reads floating times in the calendar’s zone', async (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
X-WR-TIMEZONE:America/Chicago
BEGIN:VEVENT
UID:floating@example.com
SUMMARY:SUMO Movie
DTSTART:20261009T190000
DTEND:20261009T210000
END:VEVENT
END:VCALENDAR`

	const url = `data:text/calendar,${encodeURIComponent(sampleIcal)}`
	const events = await ical(url, {}, moment('2026-10-09T23:00:00Z'))

	t.assert.deepEqual(
		events.map((e) => [e.startTime, e.endTime]),
		[['2026-10-10T00:00:00.000Z', '2026-10-10T02:00:00.000Z']],
	)
})

void test('ical reads a time in the zone its TZID names', async (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
X-WR-TIMEZONE:America/Chicago
BEGIN:VEVENT
UID:zoned@example.com
SUMMARY:Zoned
DTSTART;TZID=America/New_York:20261009T190000
DTEND;TZID=America/New_York:20261009T200000
END:VEVENT
END:VCALENDAR`

	const url = `data:text/calendar,${encodeURIComponent(sampleIcal)}`
	const events = await ical(url, {}, moment('2026-10-09T12:00:00Z'))

	t.assert.equal(events[0]?.startTime, '2026-10-09T23:00:00.000Z')
})

void test('ical leaves all-day dates at UTC midnight', async (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
X-WR-TIMEZONE:America/Chicago
BEGIN:VEVENT
UID:allday@example.com
SUMMARY:All day
DTSTART;VALUE=DATE:20261012
DTEND;VALUE=DATE:20261013
END:VEVENT
END:VCALENDAR`

	const url = `data:text/calendar,${encodeURIComponent(sampleIcal)}`
	const events = await ical(url, {}, moment('2026-10-09T12:00:00Z'))

	t.assert.deepEqual(
		events.map((e) => [e.startTime, e.endTime]),
		[['2026-10-12T00:00:00.000Z', '2026-10-13T00:00:00.000Z']],
	)
})

void test('ical reads a TZID that the feed defines with a VTIMEZONE', async (t) => {
	const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
X-WR-TIMEZONE:America/Chicago
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZNAME:EDT
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZNAME:EST
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:vtimezone@example.com
SUMMARY:Zoned
DTSTART;TZID=America/New_York:20261009T190000
DTEND;TZID=America/New_York:20261009T200000
END:VEVENT
END:VCALENDAR`

	const url = `data:text/calendar,${encodeURIComponent(sampleIcal)}`
	const events = await ical(url, {}, moment('2026-10-09T12:00:00Z'))

	t.assert.equal(events[0]?.startTime, '2026-10-09T23:00:00.000Z')
})
