import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {describe, it} from 'node:test'
import {normalizeCalendarInterval} from './calendar.ts'
import type {CalendarInterval} from './types.ts'

const cases: {
	name: string
	interval: CalendarInterval
	timezone: string
	expected: {startMs: number; endMs: number; calendarDays: number}
}[] = [
	{
		name: 'ordinary Central day',
		interval: {date: '2026-10-10'},
		timezone: 'America/Chicago',
		expected: {startMs: Date.UTC(2026, 9, 10, 5), endMs: Date.UTC(2026, 9, 11, 5), calendarDays: 1},
	},
	{
		name: '23-hour spring DST day',
		interval: {date: '2026-03-08'},
		timezone: 'America/Chicago',
		expected: {startMs: Date.UTC(2026, 2, 8, 6), endMs: Date.UTC(2026, 2, 9, 5), calendarDays: 1},
	},
	{
		name: '25-hour fall DST day',
		interval: {date: '2026-11-01'},
		timezone: 'America/Chicago',
		expected: {startMs: Date.UTC(2026, 10, 1, 5), endMs: Date.UTC(2026, 10, 2, 6), calendarDays: 1},
	},
	{
		name: 'three days across spring DST',
		interval: {start: '2026-03-07', end: '2026-03-09'},
		timezone: 'America/Chicago',
		expected: {startMs: Date.UTC(2026, 2, 7, 6), endMs: Date.UTC(2026, 2, 10, 5), calendarDays: 3},
	},
	{
		name: 'three days across fall DST',
		interval: {start: '2026-10-31', end: '2026-11-02'},
		timezone: 'America/Chicago',
		expected: {startMs: Date.UTC(2026, 9, 31, 5), endMs: Date.UTC(2026, 10, 3, 6), calendarDays: 3},
	},
	{
		name: '23-hour day when DST skips midnight',
		interval: {date: '2026-09-06'},
		timezone: 'America/Santiago',
		expected: {startMs: Date.UTC(2026, 8, 6, 4), endMs: Date.UTC(2026, 8, 7, 3), calendarDays: 1},
	},
	{
		name: 'leap day in UTC',
		interval: {date: '2028-02-29'},
		timezone: 'UTC',
		expected: {startMs: Date.UTC(2028, 1, 29), endMs: Date.UTC(2028, 2, 1), calendarDays: 1},
	},
	{
		name: 'New Year east of UTC',
		interval: {start: '2026-12-31', end: '2027-01-01'},
		timezone: 'Asia/Singapore',
		expected: {
			startMs: Date.UTC(2026, 11, 30, 16),
			endMs: Date.UTC(2027, 0, 1, 16),
			calendarDays: 2,
		},
	},
]

void describe('timezone-aware calendar normalization', () => {
	for (let {name, interval, timezone, expected} of cases) {
		void it(name, () => {
			assert.deepEqual(normalizeCalendarInterval(interval, timezone), expected)
		})
	}
	for (let processTimezone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
		void it(`ignores the process timezone ${processTimezone}`, () => {
			let result = spawnSync(
				process.execPath,
				[
					'--input-type=module',
					'-e',
					`
				import {normalizeCalendarInterval} from ${JSON.stringify(new URL('./calendar.ts', import.meta.url).href)};
				const cases = ${JSON.stringify(cases)};
				console.log(JSON.stringify(cases.map(({interval, timezone}) => normalizeCalendarInterval(interval, timezone))));
			`,
				],
				{env: {...process.env, TZ: processTimezone}, encoding: 'utf8'},
			)
			assert.equal(result.status, 0, result.stderr)
			assert.deepEqual(
				JSON.parse(result.stdout) as unknown,
				cases.map(({expected}) => expected),
			)
		})
	}
	void it('treats singletons and same-day ranges identically', () => {
		assert.deepEqual(
			normalizeCalendarInterval({date: '2026-03-08'}, 'America/Chicago'),
			normalizeCalendarInterval({start: '2026-03-08', end: '2026-03-08'}, 'America/Chicago'),
		)
	})
	void it('does not mutate the authored dates', () => {
		let interval = Object.freeze({start: '2026-10-10', end: '2026-10-13'})
		normalizeCalendarInterval(interval, 'America/Chicago')
		assert.deepEqual(interval, {start: '2026-10-10', end: '2026-10-13'})
	})
	for (let date of [
		'2026-02-29',
		'2026-04-31',
		'2026-13-01',
		'2026-01-00',
		'2026-1-1',
		'2026-10-10T00:00:00Z',
		'',
	]) {
		void it(`rejects invalid date ${JSON.stringify(date)}`, () => {
			assert.throws(
				() => normalizeCalendarInterval({date}, 'America/Chicago'),
				/Invalid calendar date/u,
			)
		})
	}
	for (let interval of [
		{},
		{start: '2026-10-10'},
		{end: '2026-10-13'},
		{date: '2026-10-10', start: '2026-10-10', end: '2026-10-13'},
	]) {
		void it(`rejects malformed interval ${JSON.stringify(interval)}`, () => {
			assert.throws(
				() => normalizeCalendarInterval(interval as CalendarInterval, 'America/Chicago'),
				/requires date or both start and end/u,
			)
		})
	}
	void it('rejects reversed dates', () => {
		assert.throws(
			() => normalizeCalendarInterval({start: '2026-10-13', end: '2026-10-10'}, 'America/Chicago'),
			/on or before/u,
		)
	})
	for (let timezone of ['', 'Invalid/Timezone']) {
		void it(`rejects unusable timezone ${JSON.stringify(timezone)}`, () => {
			assert.throws(() => normalizeCalendarInterval({date: '2026-10-10'}, timezone))
		})
	}
})
