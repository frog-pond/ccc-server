import {test} from 'node:test'
import {parseCalendar} from './ical.ts'

/// Upstream calendars answer 200 with an HTML page when their feed goes away,
/// so the body — not the status — is the only thing that says whether we got a
/// calendar. Left unguarded, ical.js reports that as a syntax error deep in its
/// parser, which reads as a bug in this server rather than a dead source.

const CALENDAR = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:test@example.com
SUMMARY:Test Event
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
END:VEVENT
END:VCALENDAR`

void test('parseCalendar reads a calendar body', (t) => {
	let comp = parseCalendar(CALENDAR, 'https://example.com/feed.ics')

	t.assert.equal(comp.getAllSubcomponents('vevent').length, 1)
})

void test('parseCalendar rejects an HTML page with the source in the message', (t) => {
	t.assert.throws(
		() =>
			parseCalendar(
				'<!DOCTYPE html>\n<html><body>Not a feed</body></html>',
				'https://example.com/feed.ics',
			),
		(error: Error) => {
			t.assert.match(error.message, /did not return a calendar/i)
			t.assert.match(error.message, /example\.com\/feed\.ics/)
			return true
		},
	)
})

void test('parseCalendar rejects an empty body', (t) => {
	t.assert.throws(
		() => parseCalendar('   \n  ', 'https://example.com/feed.ics'),
		/did not return a calendar/i,
	)
})

void test('parseCalendar accepts a body with leading whitespace', (t) => {
	let comp = parseCalendar(`\n  ${CALENDAR}`, 'https://example.com/feed.ics')

	t.assert.equal(comp.getAllSubcomponents('vevent').length, 1)
})
