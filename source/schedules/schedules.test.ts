import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {describe, it} from 'node:test'
import {parseScheduleData} from './parse.ts'
import {calendarResponse, resolveScheduleData, resolveSchedules} from './resolve.ts'

function must<T>(value: T | undefined): T {
	assert.notEqual(value, undefined)
	if (value === undefined) throw new Error('missing test fixture field')
	return value
}

function fixture(name: string): unknown {
	return JSON.parse(
		readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8'),
	) as unknown
}
function pair() {
	return {calendar: fixture('calendar'), spaces: fixture('spaces')}
}
function set(input: unknown, path: string, value: unknown) {
	let keys = path.split('.')
	let target = input as Record<string, unknown>
	for (let key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>
	let key = must(keys.at(-1))
	if (value === undefined) Reflect.deleteProperty(target, key)
	else target[key] = value
}
const closed = [{title: 'Closed', isPhysicallyOpen: false, hours: []}]

void describe('server schedule contracts', () => {
	void it('matches complete upstream hours and calendar response fixtures without mutating inputs', () => {
		let input = pair()
		let before = structuredClone(input)
		assert.deepEqual(resolveScheduleData(input.calendar, input.spaces), fixture('spaces-resolved'))
		let parsed = parseScheduleData(input.calendar, input.spaces)
		assert.deepEqual(calendarResponse(parsed.calendar), fixture('calendar-response'))
		assert.deepEqual(input, before)
		assert.equal(must(must(parsed.spaces[0]).breakSchedule)['easter'], 'spring')
	})
	void it('preserves normal schedule exceptions through break aliases', () => {
		let input = pair()
		let christmasEve = {date: '2026-12-24', schedule: closed}
		set(input, 'spaces.0.exceptions', [christmasEve])
		set(input, 'spaces.0.breakSchedule', {winter: 'normal', fall: 'winter'})
		let before = structuredClone(input)
		let resolved = must(resolveScheduleData(input.calendar, input.spaces).data[0])
		for (let key of ['winter', 'fall']) {
			assert.deepEqual(must(must(resolved.breakSchedule)[key]).exceptions, [christmasEve])
		}
		assert.deepEqual(input, before)
	})
	void it('normal schedules without space exceptions resolve to an empty exception list', () => {
		let input = pair()
		set(input, 'spaces.0.exceptions', undefined)
		set(input, 'spaces.0.breakSchedule', {winter: 'normal'})
		let resolved = must(resolveScheduleData(input.calendar, input.spaces).data[0])
		assert.deepEqual(must(must(resolved.breakSchedule)['winter']).exceptions, [])
	})
	void it('resolves forward chains in the target context and retains exceptions', () => {
		let input = pair()
		set(input, 'spaces.0.breakSchedule', {
			winter: 'easter',
			easter: 'spring',
			spring: 'office-hours',
		})
		let {calendar, spaces} = parseScheduleData(input.calendar, input.spaces)
		let before = structuredClone({calendar, spaces})
		let resolved = resolveSchedules(calendar, spaces)
		for (let key of ['winter', 'easter', 'spring']) {
			assert.deepEqual(
				must(must(resolved[0]).breakSchedule)[key],
				must(must(calendar.breaks['spring']).templates)['office-hours'],
			)
		}
		assert.deepEqual({calendar, spaces}, before)
	})
	void it('resolves local defaults and replaces whole template policies, including empty exceptions', () => {
		let input = pair()
		set(input, 'calendar.breaks.spring.defaultSpaceSchedule', 'office-hours')
		set(input, 'calendar.breaks.spring.templates.office-hours', closed)
		set(input, 'spaces.0.breakSchedule.spring', 'inherit')
		let {calendar, spaces} = parseScheduleData(input.calendar, input.spaces)
		assert.deepEqual(must(must(resolveSchedules(calendar, spaces)[0]).breakSchedule)['easter'], {
			schedule: closed,
			exceptions: [],
		})
	})
	void it('preserves missing containers, empty mappings and unrelated metadata', () => {
		let input = pair()
		set(input, 'spaces.0.breakSchedule', undefined)
		set(input, 'spaces.0.futureMetadata', {nested: [1, 2]})
		set(input, 'spaces.1.breakSchedule', {})
		let {calendar, spaces} = parseScheduleData(input.calendar, input.spaces)
		let resolved = resolveSchedules(calendar, spaces)
		assert.equal(Object.hasOwn(must(resolved[0]), 'breakSchedule'), false)
		assert.deepEqual(must(resolved[0])['futureMetadata'], {nested: [1, 2]})
		assert.deepEqual(must(resolved[1]).breakSchedule, {})
	})
	void it('normalizes arrays and omitted exceptions at every policy boundary', () => {
		let {calendar, spaces} = parseScheduleData(fixture('calendar'), fixture('spaces'))
		assert.deepEqual(must(calendar.templates)['closed'], {schedule: closed, exceptions: []})
		assert.deepEqual(must(calendar.breaks['interim']).defaultSpaceSchedule, {
			schedule: closed,
			exceptions: [],
		})
		assert.deepEqual(
			(must(calendar.breaks['winter']).defaultSpaceSchedule as {exceptions: unknown}).exceptions,
			[],
		)
		assert.deepEqual(
			(must(must(spaces[1]).breakSchedule)['fall'] as {exceptions: unknown}).exceptions,
			[],
		)
	})

	const invalid: [string, string, unknown][] = [
		['empty space name', 'spaces.0.name', ''],
		['blank space name', 'spaces.0.name', '   '],
		['unknown break', 'spaces.0.breakSchedule.fal', 'normal'],
		['unknown template', 'spaces.0.breakSchedule.spring', 'typo'],
		['template from another context', 'spaces.0.breakSchedule.easter', 'spring-only'],
		['missing alias target', 'spaces.0.breakSchedule', {easter: 'fall'}],
		['self-reference', 'spaces.0.breakSchedule.easter', 'easter'],
		['cycle', 'spaces.0.breakSchedule', {fall: 'winter', winter: 'spring', spring: 'fall'}],
		['inherit without default', 'spaces.0.breakSchedule.easter', 'inherit'],
		['prototype template', 'spaces.0.breakSchedule.fall', 'toString'],
		['global collision', 'calendar.templates.fall', closed],
		['local collision', 'calendar.breaks.spring.templates.fall', closed],
		['unknown unused default', 'calendar.breaks.fall.defaultSpaceSchedule', 'unknown'],
		['cross-break default', 'calendar.breaks.fall.defaultSpaceSchedule', 'winter'],
		['global template reference', 'calendar.templates.closed', 'office-hours'],
		['local template reference', 'calendar.breaks.spring.templates.spring-only', 'closed'],
		['empty shorthand', 'spaces.0.breakSchedule.fall', []],
		['missing block title', 'spaces.0.schedule.0.title', undefined],
		['missing hours', 'spaces.0.schedule.0.hours', undefined],
		['unexplained hours', 'spaces.0.schedule', [{title: 'Hours', hours: []}]],
		[
			'open empty hours',
			'spaces.0.schedule',
			[{title: 'Hours', hours: [], isPhysicallyOpen: true}],
		],
		['blank notes', 'spaces.0.schedule', [{title: 'Hours', hours: [], notes: '   '}]],
		['date on service', 'spaces.0.schedule.0.date', '2026-10-10'],
		['empty weekdays', 'spaces.0.schedule.0.hours.0.days', []],
		['duplicate weekdays', 'spaces.0.schedule.0.hours.0.days', ['Mo', 'Mo']],
		['invalid weekdays', 'spaces.0.schedule.0.hours.0.days', ['Monday']],
		['missing from time', 'spaces.0.schedule.0.hours.0.from', undefined],
		['invalid time', 'spaces.0.schedule.0.hours.0.from', '25:99am'],
		['invalid timezone', 'calendar.timezone', 'Invalid/Timezone'],
		['missing timezone', 'calendar.timezone', undefined],
		['invalid date', 'calendar.breaks.easter.date', '2027-02-29'],
		['timestamp date', 'calendar.breaks.easter.date', '2027-03-28T00:00:00Z'],
		['reversed interval', 'calendar.breaks.fall.end', '2026-10-09'],
		['mixed interval', 'calendar.breaks.fall.date', '2026-10-10'],
		['incomplete interval', 'calendar.breaks.fall.end', undefined],
		['missing name', 'calendar.breaks.fall.name', undefined],
		[
			'duplicate interval',
			'calendar.breaks.duplicate',
			{name: 'Duplicate', start: '2027-03-28', end: '2027-03-28'},
		],
	]
	void it('rejects duplicate space names with both input locations', () => {
		let input = pair()
		set(input, 'spaces.1.name', 'Example office')
		assert.throws(
			() => resolveScheduleData(input.calendar, input.spaces),
			/spaces\[1\]\.name: duplicate space name Example office; first defined at spaces\[0\]\.name/u,
		)
	})
	for (let reserved of ['normal', 'inherit']) {
		invalid.push(
			[
				`reserved break ${reserved}`,
				`calendar.breaks.${reserved}`,
				{name: reserved, date: '2027-05-18'},
			],
			[`reserved template ${reserved}`, `calendar.templates.${reserved}`, closed],
			[
				`reserved local template ${reserved}`,
				`calendar.breaks.spring.templates.${reserved}`,
				closed,
			],
			[`reserved default ${reserved}`, 'calendar.breaks.fall.defaultSpaceSchedule', reserved],
		)
	}
	for (let path of [
		'spaces.0',
		'spaces.0.breakSchedule.interim',
		'calendar.breaks.winter.defaultSpaceSchedule',
		'calendar.templates.office-hours',
		'calendar.breaks.spring.templates.office-hours',
		'spaces.0.exceptions.0',
		'spaces.0.breakSchedule.interim.exceptions.0',
	]) {
		invalid.push([`empty ${path}`, `${path}.schedule`, []])
	}
	for (let path of [
		'spaces.0',
		'spaces.0.breakSchedule.interim',
		'calendar.templates.office-hours',
	]) {
		invalid.push(
			[
				`duplicate exception ${path}`,
				`${path}.exceptions`,
				[
					{date: '2026-10-10', schedule: closed},
					{date: '2026-10-10', schedule: closed},
				],
			],
			[`invalid exception ${path}`, `${path}.exceptions.0.date`, '2026-02-29'],
			[
				`exception range ${path}`,
				`${path}.exceptions.0`,
				{start: '2026-10-10', end: '2026-10-13', schedule: closed},
			],
		)
	}
	for (let [name, path, value] of invalid) {
		void it(`rejects ${name} before returning a response`, () => {
			let input = pair()
			set(input, path, value)
			assert.throws(() => resolveScheduleData(input.calendar, input.spaces))
		})
	}
	const transitions: [string, string, string][] = [
		['2026-03-07', '2026-03-09', '2026-03-11'],
		['2026-10-31', '2026-11-02', '2026-11-04'],
	]
	for (let [start, end, secondEnd] of transitions) {
		void it(`rejects equal-day-span overlaps across DST from ${start}`, () => {
			let calendar = {
				timezone: 'America/Chicago',
				breaks: {
					first: {name: 'First', start, end},
					second: {
						name: 'Second',
						start: end,
						end: secondEnd,
					},
				},
			}
			assert.throws(() => parseScheduleData(calendar, []), /equal calendar-day span/u)
		})
	}
	void it('accepts adjacent equal spans, arbitrary matched keys and an empty calendar', () => {
		assert.doesNotThrow(() => parseScheduleData({timezone: 'America/Chicago', breaks: {}}, []))
		let input = pair()
		set(input, 'calendar.breaks.readingDay', {name: 'Reading Day', date: '2027-05-18'})
		set(input, 'spaces.0.breakSchedule.readingDay', 'normal')
		assert.doesNotThrow(() => parseScheduleData(input.calendar, input.spaces))
		assert.doesNotThrow(() =>
			parseScheduleData(
				{
					timezone: 'America/Chicago',
					breaks: {
						first: {name: 'First', start: '2026-03-07', end: '2026-03-09'},
						second: {name: 'Second', start: '2026-03-10', end: '2026-03-12'},
					},
				},
				[],
			),
		)
	})
})
