import {test} from 'node:test'

import * as bonApp from './index.ts'
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
