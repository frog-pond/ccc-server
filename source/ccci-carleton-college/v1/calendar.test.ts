import {test} from 'node:test'
import {noop} from 'lodash-es'
import type {Context} from '../../ccc-server/context.ts'
import {northfield} from './calendar.ts'

void test('Northfield calendar uses the published ICS feed', async (t) => {
	let requestedUrl: string | undefined
	t.mock.method(globalThis, 'fetch', (request: Parameters<typeof fetch>[0]) => {
		requestedUrl = request instanceof Request ? request.url : String(request)
		return Promise.resolve(
			new Response(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:northfield-test
SUMMARY:Northfield test event
DTSTART:20300101T100000Z
DTEND:20300101T110000Z
END:VEVENT
END:VCALENDAR`),
		)
	})

	const ctx = {cacheControl: noop, cached: () => false, body: null} as Context
	await northfield(ctx)

	t.assert.equal(
		requestedUrl,
		'https://www.northfieldmn.gov/common/modules/iCalendar/iCalendar.aspx?catID=41&feed=calendar',
	)
	t.assert.equal((ctx.body as {title: string}[])[0]?.title, 'Northfield test event')
})
