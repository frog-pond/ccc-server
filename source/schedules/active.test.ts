import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {describe, it} from 'node:test'
import {activeBreaks, campusDate, hoursAt, secondsUntilMidnight} from './active.ts'
import {resolveScheduleResponses} from './resolve.ts'

function fixture(name: string): unknown {
	return JSON.parse(
		readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8'),
	) as unknown
}

const responses = () => resolveScheduleResponses(fixture('calendar'), fixture('spaces'))
const space = (hours: ReturnType<typeof hoursAt>, name: string) => {
	let found = hours.data.find((s) => s['name'] === name)
	assert.ok(found)
	return found
}

void describe('campus dates', () => {
	void it('uses the campus day, not the UTC one', () => {
		// 7 PM in Northfield is already the next day in UTC
		assert.equal(campusDate(Date.parse('2026-10-10T00:30:00Z'), 'America/Chicago'), '2026-10-09')
		assert.equal(campusDate(Date.parse('2026-10-10T05:30:00Z'), 'America/Chicago'), '2026-10-10')
	})

	void it('counts the seconds left in the campus day', () => {
		assert.equal(secondsUntilMidnight(Date.parse('2026-10-11T04:30:00Z'), 'America/Chicago'), 1800)
	})
})

void describe('active breaks', () => {
	void it('includes both ends of a break', () => {
		let {calendar} = responses()
		assert.deepEqual(activeBreaks(calendar, '2026-10-09'), [])
		assert.deepEqual(activeBreaks(calendar, '2026-10-10'), ['fall'])
		assert.deepEqual(activeBreaks(calendar, '2026-10-13'), ['fall'])
		assert.deepEqual(activeBreaks(calendar, '2026-10-14'), [])
	})

	void it('puts a one-day break ahead of the longer break around it', () => {
		assert.deepEqual(activeBreaks(responses().calendar, '2027-03-28'), ['easter', 'spring'])
	})
})

void describe('hours at a moment', () => {
	void it('is the resolved hours, untouched, outside any break', () => {
		let input = responses()
		assert.equal(hoursAt(input, Date.parse('2026-11-01T18:00:00Z')), input.hours)
	})

	void it("serves a break's schedule and exceptions in place of the usual ones", () => {
		let input = responses()
		let before = structuredClone(input)
		let hours = hoursAt(input, Date.parse('2026-10-11T18:00:00Z'))
		for (let name of ['Example office', 'Example building']) {
			let resolved = space(input.hours, name)
			let fall = resolved.breakSchedule?.['fall']
			assert.ok(fall)
			assert.deepEqual(space(hours, name), {
				...resolved,
				schedule: fall.schedule,
				exceptions: fall.exceptions,
			})
		}
		assert.deepEqual(input, before)
	})

	void it('keeps the usual hours for a space with nothing for the break', () => {
		let input = responses()
		let hours = hoursAt(input, Date.parse('2027-03-28T18:00:00Z'))
		assert.deepEqual(space(hours, 'Example building'), space(input.hours, 'Example building'))
		let office = space(input.hours, 'Example office')
		assert.deepEqual(
			space(hours, 'Example office').schedule,
			office.breakSchedule?.['easter']?.schedule,
		)
	})
})
