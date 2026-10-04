import {test} from 'node:test'
import moment from 'moment'
import {convertGoogleEvents} from './google.ts'

const EVENT = {
	start: {dateTime: '2026-10-04T19:00:00-05:00'},
	end: {dateTime: '2026-10-04T21:00:00-05:00'},
	summary: 'Concert',
}

void test('every line break in a Google event description is kept', (t) => {
	const [event] = convertGoogleEvents([
		{...EVENT, description: 'Doors at 7<br>Show at 8<BR/>Free with ID<br />Bring a friend'},
	])
	t.assert.equal(event?.description, 'Doors at 7\nShow at 8\nFree with ID\nBring a friend')
})

void test('a Google event is ongoing when it began on an earlier day', (t) => {
	const [event] = convertGoogleEvents(
		[
			{
				...EVENT,
				start: {dateTime: '2026-10-03T12:00:00-05:00'},
				end: {dateTime: '2026-10-06T21:00:00-05:00'},
			},
		],
		moment('2026-10-05T12:00:00-05:00'),
	)
	t.assert.equal(event?.isOngoing, true)
})
