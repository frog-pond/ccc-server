import {test} from 'node:test'
import {parsePercent, percentRollout} from './feature-flags.ts'

void test('parsePercent reads a percentage from 0 to 100', (t) => {
	t.assert.equal(parsePercent('X', '0'), 0)
	t.assert.equal(parsePercent('X', '12.5'), 12.5)
	t.assert.equal(parsePercent('X', ' 100 '), 100)
})

void test('parsePercent treats an unset or empty value as 0, quietly', (t) => {
	let warn = t.mock.method(console, 'warn', () => undefined)
	t.assert.equal(parsePercent('X', undefined), 0)
	t.assert.equal(parsePercent('X', ''), 0)
	t.assert.equal(warn.mock.callCount(), 0)
})

void test('parsePercent treats anything else as 0, with a warning', (t) => {
	let warn = t.mock.method(console, 'warn', () => undefined)
	for (let raw of ['abc', '-1', '101', 'NaN', 'Infinity', '50%']) {
		t.assert.equal(parsePercent('X', raw), 0, raw)
	}
	t.assert.equal(warn.mock.callCount(), 6)
})

void test('percentRollout is on for the given share of checks, and records each', (t) => {
	let recorded: [string, boolean][] = []
	let rolls = [0, 0.249, 0.25, 0.99]
	let check = percentRollout('my-flag', 25, {
		random: () => rolls.shift() ?? 0,
		record: (name, value) => recorded.push([name, value]),
	})

	t.assert.deepEqual([check(), check(), check(), check()], [true, true, false, false])
	t.assert.deepEqual(recorded, [
		['my-flag', true],
		['my-flag', true],
		['my-flag', false],
		['my-flag', false],
	])
})

void test('percentRollout at 0 is never on, and at 100 always', (t) => {
	let record = () => undefined
	let never = percentRollout('f', 0, {random: () => 0, record})
	let always = percentRollout('f', 100, {random: () => 0.999999, record})
	t.assert.equal(never(), false)
	t.assert.equal(always(), true)
})
