import {test} from 'node:test'
import moment from 'moment'
import {ical} from './ical.ts'
import {googleCalendar} from './google.ts'
import {captureMetrics, takeMetrics} from '../ccc-lib/metrics-testing.ts'

const seen = captureMetrics()

const NOW = moment('2026-10-05T12:00:00Z')

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:past@example.com
SUMMARY:Past
DTSTART:20261001T100000Z
DTEND:20261001T110000Z
END:VEVENT
BEGIN:VEVENT
UID:a@example.com
SUMMARY:Concert
DTSTART:20261010T100000Z
DTEND:20261010T110000Z
END:VEVENT
BEGIN:VEVENT
UID:b@example.com
SUMMARY:Lecture
DTSTART:20261011T100000Z
DTEND:20261011T110000Z
END:VEVENT
END:VCALENDAR`

function serve(t: test.TestContext, body: string) {
	t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(body)))
}

void test('an iCal feed is told with how many events it gave, by host alone', async (t) => {
	serve(t, ICS)
	// a private feed's path carries its token
	let events = await ical('https://calendar.example.com/private-abc123/basic.ics', {}, NOW)
	t.assert.equal(events.length, 2)
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [
		[2, {source: 'ical', feed: 'calendar.example.com'}],
	])
})

void test('an iCal feed that is not a calendar is counted as a failure, and still throws', async (t) => {
	serve(t, '<html>moved</html>')
	await t.assert.rejects(ical('https://calendar.example.com/old.ics', {}, NOW))
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [])
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [
		[1, {source: 'ical', feed: 'calendar.example.com'}],
	])
})

void test('a Google calendar is told with how many events it gave, by its id', async (t) => {
	serve(
		t,
		JSON.stringify({
			items: [{start: {date: '2026-10-10'}, end: {date: '2026-10-11'}, summary: 'Fall break'}],
		}),
	)
	await googleCalendar('events@example.edu', NOW)
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [
		[1, {source: 'google-calendar', feed: 'events@example.edu'}],
	])
})

void test('a Google calendar answer of the wrong shape is counted as a failure', async (t) => {
	serve(t, JSON.stringify({error: 'nope'}))
	await t.assert.rejects(googleCalendar('events@example.edu', NOW))
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [
		[1, {source: 'google-calendar', feed: 'events@example.edu'}],
	])
})
