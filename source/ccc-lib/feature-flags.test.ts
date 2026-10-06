import {test} from 'node:test'
import {parsePercent, percentChance} from './feature-flags.ts'

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

void test('percentChance comes up for the given share of checks', (t) => {
	let rolls = [0, 0.249, 0.25, 0.99]
	let check = percentChance(25, () => rolls.shift() ?? 0)
	t.assert.deepEqual([check(), check(), check(), check()], [true, true, false, false])
})

void test('percentChance at 0 never comes up, and at 100 always', (t) => {
	t.assert.equal(percentChance(0, () => 0)(), false)
	t.assert.equal(percentChance(100, () => 0.999999)(), true)
})
