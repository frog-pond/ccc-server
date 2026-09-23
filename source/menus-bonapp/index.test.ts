import {test} from 'node:test'

import * as bonApp from './index.ts'
import {campusToday} from './helpers.ts'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.ts'

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

void test('fetching cafe info should not throw', {timeout: 15_000}, async (t) => {
	await t.assert.doesNotReject(bonApp._cafe(STAV))
})

void test(
	'fetching cafe info should return a CafeInfoResponseSchema struct',
	{timeout: 15_000},
	async (t) => {
		const data = await bonApp._cafe(STAV)
		t.assert.doesNotThrow(() => CafeInfoResponseSchema.parse(data))
	},
)

void test('fetching menu info should not throw', {timeout: 15_000}, async (t) => {
	await t.assert.doesNotReject(bonApp._menu(STAV))
})

void test(
	'fetching menu info should return a CafeMenuResponseSchema struct',
	{timeout: 15_000},
	async (t) => {
		const data = await bonApp._menu(STAV)
		t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(data))
	},
)

// The dayparts are the ones BonApp's page shows for today, which is today on
// campus -- including in the evening, when UTC has already moved on.
void test('cafe info is dated by the campus calendar', {timeout: 15_000}, async (t) => {
	const data = await bonApp._cafe(STAV)
	t.assert.equal(data.cafe.days[0]?.date, campusToday())
})

void test('menu info is dated by the campus calendar', {timeout: 15_000}, async (t) => {
	const data = await bonApp._menu(STAV)
	t.assert.equal(data.days[0]?.date, campusToday())
})
