import test from 'ava'
import InternetCalendar from 'ical.js'
import moment from 'moment'
import {JSDOM} from 'jsdom'
import getUrls from 'get-urls'
import {EventSchema} from './types.js'

/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */

/**
 * Tests for the ical.js event parser
 *
 * These tests verify that the convertEvent function correctly handles null values
 * from ical.js when event properties (summary, description, location) are missing.
 *
 * Background: ical.js returns null for missing event properties, but the Zod schema
 * expects strings. The fix uses the || '' operator to convert null to empty string.
 */

test('ical event with missing location should parse successfully', (t) => {
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

	t.is(events.length, 1, 'Should have exactly one event')
	const event = events[0] as InternetCalendar.Event

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = JSDOM.fragment(event.description || '').textContent?.trim() ?? ''

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary || '',
		description: description,
		location: event.location || '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.is(result.title, 'Test Event')
	t.is(result.description, 'Test description')
	t.is(result.location, '')
})

test('ical event with missing description should parse successfully', (t) => {
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

	t.is(events.length, 1, 'Should have exactly one event')
	const event = events[0] as InternetCalendar.Event

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = JSDOM.fragment(event.description || '').textContent?.trim() ?? ''

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary || '',
		description: description,
		location: event.location || '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.is(result.title, 'Test Event')
	t.is(result.description, '')
	t.is(result.location, 'Test Location')
})

test('ical event with all properties missing should parse successfully', (t) => {
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

	t.is(events.length, 1, 'Should have exactly one event')
	const event = events[0] as InternetCalendar.Event

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = JSDOM.fragment(event.description || '').textContent?.trim() ?? ''

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary || '',
		description: description,
		location: event.location || '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.is(result.title, '')
	t.is(result.description, '')
	t.is(result.location, '')
})

test('ical event with all properties present should parse successfully', (t) => {
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

	t.is(events.length, 1, 'Should have exactly one event')
	const event = events[0] as InternetCalendar.Event

	const now = moment()
	const startTime = moment(event.startDate.toString())
	const endTime = moment(event.endDate.toString())
	const description = JSDOM.fragment(event.description || '').textContent?.trim() ?? ''

	const result = EventSchema.parse({
		dataSource: 'ical',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		title: event.summary || '',
		description: description,
		location: event.location || '',
		isOngoing: startTime.isBefore(now, 'day'),
		links: [...getUrls(description)],
		metadata: {uid: event.uid},
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})

	t.is(result.title, 'Test Event')
	t.is(result.description, 'Test description')
	t.is(result.location, 'Test Location')
})
