import {suite, test} from 'node:test'
import moment from 'moment-timezone'
import {weeklyScheduleEvents, type WeeklySchedule} from './weekly-schedule.ts'

const TZ = 'America/Chicago'

function schedule(shows: WeeklySchedule['shows']): WeeklySchedule {
	return {updated: '2026-03-22T16:24:01Z', timezone: TZ, shows}
}

/** A moment given in the station's own time. */
const central = (text: string) => moment.tz(text, TZ)

void suite('weeklyScheduleEvents', () => {
	void test('places each slot at its wall-clock time in the station timezone', (t) => {
		// Friday 2 October 2026, 13:30 Central.
		let now = central('2026-10-02T13:30')
		let [first] = weeklyScheduleEvents(
			schedule([{day: 'friday', start: '14:00', end: '15:00', title: 'Golf Carts'}]),
			now,
		)
		t.assert.equal(first?.title, 'Golf Carts')
		t.assert.equal(first?.startTime, '2026-10-02T19:00:00.000Z')
		t.assert.equal(first?.endTime, '2026-10-02T20:00:00.000Z')
	})

	void test('keeps a show that is on air now, and drops one that has ended', (t) => {
		let now = central('2026-10-02T14:30')
		let events = weeklyScheduleEvents(
			schedule([
				{day: 'friday', start: '13:00', end: '14:00', title: 'Over'},
				{day: 'friday', start: '14:00', end: '15:00', title: 'On air'},
			]),
			now,
		)
		t.assert.equal(events[0]?.title, 'On air')
		// Next week's airing remains; today's, which has ended, does not.
		let over = events.filter((event) => event.title === 'Over')
		t.assert.deepEqual(
			over.map((event) => event.startTime),
			[central('2026-10-09T13:00').toISOString()],
		)
	})

	void test('repeats each slot weekly for two weeks, in order', (t) => {
		let events = weeklyScheduleEvents(
			schedule([
				{day: 'monday', start: '09:00', end: '10:00', title: 'Mondays'},
				{day: 'sunday', start: '09:00', end: '10:00', title: 'Sundays'},
			]),
			central('2026-10-02T12:00'),
		)
		t.assert.deepEqual(
			events.map((event) => event.title),
			['Sundays', 'Mondays', 'Sundays', 'Mondays'],
		)
	})

	void test('ends a 24:00 slot at the next midnight', (t) => {
		let [late] = weeklyScheduleEvents(
			schedule([{day: 'friday', start: '23:00', end: '24:00', title: 'Late'}]),
			central('2026-10-02T12:00'),
		)
		t.assert.equal(late?.endTime, central('2026-10-03T00:00').toISOString())
	})

	void test('keeps a show at its local hour across the end of daylight saving', (t) => {
		// Central time falls back on Sunday 1 November 2026.
		let events = weeklyScheduleEvents(
			schedule([{day: 'monday', start: '09:00', end: '10:00', title: 'Morning'}]),
			central('2026-10-27T12:00'),
		)
		t.assert.deepEqual(
			events.map((event) => event.startTime),
			['2026-11-02T15:00:00.000Z', '2026-11-09T15:00:00.000Z'],
		)
	})

	void test('carries the genre as the description and the poster as a link', (t) => {
		let [event] = weeklyScheduleEvents(
			schedule([
				{
					day: 'friday',
					start: '14:00',
					end: '15:00',
					title: 'Golf Carts',
					genre: 'Comedy',
					poster: 'https://example.com/poster.jpg',
				},
			]),
			central('2026-10-02T12:00'),
		)
		t.assert.equal(event?.description, 'Comedy')
		t.assert.deepEqual(event?.links, ['https://example.com/poster.jpg'])
	})
})
