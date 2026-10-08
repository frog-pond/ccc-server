import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {describe, it} from 'node:test'
import {z} from 'zod'
import {resolveScheduleResponses} from './resolve.ts'

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

function resolve(input: ReturnType<typeof pair>) {
	return resolveScheduleResponses(input.calendar, input.spaces)
}

const closed = {schedule: [{title: 'Closed', isPhysicallyOpen: false, hours: []}], exceptions: []}

void describe('schedule expansion', () => {
	void it('matches both public response fixtures without mutating inputs', () => {
		let input = pair()
		let before = structuredClone(input)
		assert.deepEqual(resolve(input), {
			hours: fixture('spaces-resolved'),
			calendar: fixture('calendar-response'),
		})
		assert.deepEqual(input, before)
	})

	void it('resolves forward aliases in the target context, independent of entry order', () => {
		let input = pair()
		set(input, 'spaces.0.breakSchedule', {
			winter: 'easter',
			easter: 'spring',
			spring: 'office-hours',
		})
		let expected = resolve(input)
		let policies = must(must(expected.hours.data[0]).breakSchedule)
		assert.deepEqual(policies['winter'], policies['spring'])
		assert.deepEqual(policies['easter'], policies['spring'])
		assert.deepEqual(must(must(policies['spring']).exceptions[0]).date, '2027-03-20')
		set(input, 'spaces.0.breakSchedule', {
			spring: 'office-hours',
			easter: 'spring',
			winter: 'easter',
		})
		assert.deepEqual(resolve(input), expected)
	})

	void it('inherits local defaults as whole policies without merging global exceptions', () => {
		let input = pair()
		set(input, 'calendar.breaks.spring.defaultSpaceSchedule', 'office-hours')
		set(input, 'calendar.breaks.spring.templates.office-hours', closed)
		set(input, 'spaces.0.breakSchedule.spring', 'inherit')
		assert.deepEqual(must(must(resolve(input).hours.data[0]).breakSchedule)['easter'], closed)
	})

	void it('carries normal exceptions through aliases and supplies an empty list when omitted', () => {
		let input = pair()
		let exceptions = [{date: '2026-12-24', schedule: closed.schedule}]
		set(input, 'spaces.0.exceptions', exceptions)
		set(input, 'spaces.0.breakSchedule', {winter: 'normal', fall: 'winter'})
		for (let key of ['winter', 'fall']) {
			assert.deepEqual(
				must(must(must(resolve(input).hours.data[0]).breakSchedule)[key]).exceptions,
				exceptions,
			)
		}
		set(input, 'spaces.0.exceptions', undefined)
		assert.deepEqual(
			must(must(must(resolve(input).hours.data[0]).breakSchedule)['winter']).exceptions,
			[],
		)
	})

	void it('preserves missing and empty break mappings and additive metadata', () => {
		let input = pair()
		set(input, 'spaces.0.breakSchedule', undefined)
		set(input, 'spaces.0.futureMetadata', {nested: [1, 2]})
		set(input, 'spaces.1.breakSchedule', {})
		let spaces = resolve(input).hours.data
		assert.equal(Object.hasOwn(must(spaces[0]), 'breakSchedule'), false)
		assert.deepEqual(must(spaces[0])['futureMetadata'], {nested: [1, 2]})
		assert.deepEqual(must(spaces[1]).breakSchedule, {})
	})

	void it('preserves opaque service content and policy metadata without applying AAO authoring rules', () => {
		let input = pair()
		let service = {futureService: {days: ['NewDay'], from: 'a new time format'}}
		let policy = {schedule: [service], exceptions: [], futureMetadata: {nested: true}}
		set(input, 'spaces.0.schedule', [service])
		set(input, 'spaces.0.breakSchedule.interim', policy)
		set(input, 'calendar.timezone', 'Upstream/OwnsThis')
		set(input, 'calendar.breaks.easter.date', 'upstream-owned date')
		let result = resolve(input)
		assert.deepEqual(must(result.hours.data[0]).schedule, [service])
		assert.deepEqual(must(must(result.hours.data[0]).breakSchedule)['interim'], policy)
		assert.equal(must(result.calendar.data.breaks['easter']).date, 'upstream-owned date')
	})

	void it('leaves unused semantic authoring errors to AAO', () => {
		let input = pair()
		set(input, 'calendar.breaks.easter.defaultSpaceSchedule', 'missing-unused-template')
		set(input, 'calendar.templates.unused', {schedule: [], exceptions: []})
		assert.doesNotThrow(() => resolve(input))
	})

	void it('accepts an empty published dataset', () => {
		assert.deepEqual(resolveScheduleResponses({timezone: 'America/Chicago', breaks: {}}, []), {
			hours: {data: []},
			calendar: {data: {timezone: 'America/Chicago', breaks: {}}},
		})
	})

	void it('does not resolve aliases through inherited space properties', () => {
		let input = pair()
		set(input, 'calendar.breaks.toString', {
			name: 'Named like a prototype method',
			date: '2027-05-18',
		})
		set(input, 'spaces.0.breakSchedule', {easter: 'toString'})
		assert.throws(() => resolve(input), /missing authored alias target/u)
	})

	for (let [name, path, value, diagnostic] of [
		['unknown break', 'spaces.0.breakSchedule.fal', 'normal', /unknown break key/u],
		['missing template', 'spaces.0.breakSchedule.spring', 'typo', /unknown template typo/u],
		[
			'wrong template scope',
			'spaces.0.breakSchedule.easter',
			'spring-only',
			/unknown template spring-only/u,
		],
		[
			'missing alias target',
			'spaces.0.breakSchedule',
			{easter: 'fall'},
			/missing authored alias target/u,
		],
		['self-reference', 'spaces.0.breakSchedule.easter', 'easter', /cyclic break reference/u],
		[
			'alias cycle',
			'spaces.0.breakSchedule',
			{fall: 'winter', winter: 'spring', spring: 'fall'},
			/fall -> winter -> spring -> fall/u,
		],
		[
			'missing default',
			'spaces.0.breakSchedule.easter',
			'inherit',
			/inherit requires a break default/u,
		],
		[
			'missing default template',
			'calendar.breaks.fall.defaultSpaceSchedule',
			'missing',
			/unknown template missing/u,
		],
		['prototype template', 'spaces.0.breakSchedule.fall', 'toString', /unknown template toString/u],
		[
			'reserved default',
			'calendar.breaks.fall.defaultSpaceSchedule',
			'normal',
			/defaults cannot use/u,
		],
		[
			'recursive default',
			'calendar.breaks.fall.defaultSpaceSchedule',
			'inherit',
			/defaults cannot use/u,
		],
		[
			'break default',
			'calendar.breaks.fall.defaultSpaceSchedule',
			'winter',
			/defaults cannot use/u,
		],
	] as const) {
		void it(`rejects ${name} during expansion before returning either response`, () => {
			let input = pair()
			set(input, path, value)
			assert.throws(() => resolve(input), diagnostic)
		})
	}

	for (let [name, path, value] of [
		['missing timezone', 'calendar.timezone', undefined],
		['missing calendar dates', 'calendar.breaks.fall.end', undefined],
		['mixed calendar interval', 'calendar.breaks.fall.date', '2026-10-10'],
		['missing space schedule', 'spaces.0.schedule', undefined],
		['non-array service container', 'spaces.0.schedule', {}],
		['YAML shorthand', 'spaces.0.breakSchedule.fall', closed.schedule],
		['missing normalized exceptions', 'spaces.0.breakSchedule.interim.exceptions', undefined],
		['non-array exceptions', 'spaces.0.exceptions', {}],
		['malformed exception', 'spaces.0.exceptions.0.schedule', undefined],
		['template reference', 'calendar.templates.closed', 'office-hours'],
	] as const) {
		void it(`rejects ${name} at the published structural boundary`, () => {
			let input = pair()
			set(input, path, value)
			assert.throws(() => resolve(input), z.ZodError)
		})
	}
})
