import {test} from 'node:test'
import type {Context} from '../../ccc-server/context.ts'
import {northfield} from './calendar.ts'

void test('Northfield calendar uses the published ICS feed', async (t) => {
	let requestedUrl: string | undefined
	t.mock.method(globalThis, 'fetch', async (request) => {
		requestedUrl = request instanceof Request ? request.url : String(request)
		return new Response(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:northfield-test
SUMMARY:Northfield test event
DTSTART:20300101T100000Z
DTEND:20300101T110000Z
END:VEVENT
END:VCALENDAR`)
	})

	const ctx = {cacheControl() {}, cached: () => false, body: null} as Context
	await northfield(ctx)

	t.assert.equal(requestedUrl, 'https://events.northfieldmn.gov/calendar.ics')
	t.assert.equal((ctx.body as {title: string}[])[0]?.title, 'Northfield test event')
})
