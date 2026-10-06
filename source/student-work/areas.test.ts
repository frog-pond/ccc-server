import {test} from 'node:test'
import {groupUnits, listedUnitsOf, OTHER_UNIT} from './areas.ts'

void test('lists the units of every area', (t) => {
	let body = {data: [{units: ['22005', '23040']}, {units: ['16118']}]}

	t.assert.deepEqual(listedUnitsOf(body), new Set(['22005', '23040', '16118']))
})

void test('reads a file of another shape as no list', (t) => {
	t.assert.equal(listedUnitsOf({data: [{units: 'nope'}]}), undefined)
	t.assert.equal(listedUnitsOf(null), undefined)
})

void test('keeps a unit some area lists', (t) => {
	t.assert.deepEqual(groupUnits({'1': '22005'}, new Set(['22005'])), {'1': '22005'})
})

void test('sends a unit no area lists to other', (t) => {
	t.assert.deepEqual(groupUnits({'1': '99999'}, new Set(['22005'])), {'1': OTHER_UNIT})
})

void test('sends a posting with no unit to other', (t) => {
	t.assert.deepEqual(groupUnits({'1': null}, new Set(['22005'])), {'1': OTHER_UNIT})
})

void test('without a list, sends only a posting with no unit to other', (t) => {
	t.assert.deepEqual(groupUnits({'1': null, '2': '99999'}, undefined), {
		'1': OTHER_UNIT,
		'2': '99999',
	})
})

void test('leaves out nothing', (t) => {
	t.assert.deepEqual(groupUnits({}, new Set()), {})
})
