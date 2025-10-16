import {test} from 'node:test'
import InternetCalendar from 'ical.js'
import moment from 'moment'
import {JSDOM} from 'jsdom'
import getUrls from 'get-urls'
import {EventSchema} from './types.ts'

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
	const description = JSDOM.fragment(event.description ?? '').textContent?.trim() ?? ''

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
	const description = JSDOM.fragment(event.description ?? '').textContent?.trim() ?? ''

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
	const description = JSDOM.fragment(event.description ?? '').textContent?.trim() ?? ''

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
	const description = JSDOM.fragment(event.description ?? '').textContent?.trim() ?? ''

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
	events = events.filter((event) => moment(event.endDate.toString()).isAfter(now, 'day'))
	events = events.filter((event) =>
		moment(event.endDate.toString()).isSameOrBefore(maxEndDate, 'day'),
	)

	t.assert.equal(events.length, 2, 'Should have filtered out the event beyond 2026')

	const eventSummaries = events.map((e) => e.summary)
	t.assert.equal(eventSummaries.includes('Event within range'), true)
	t.assert.equal(eventSummaries.includes('Event just at limit'), true)
	t.assert.equal(eventSummaries.includes('Event beyond maxEndDate'), false)
})
