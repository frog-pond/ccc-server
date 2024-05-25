import test from 'ava'

import * as bonApp from './index.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.js'

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

test('fetching cafe info should not throw', async (t) => {
	await t.notThrowsAsync(() => bonApp._cafe(STAV))
})

test('fetching cafe info should return a CafeInfoResponseSchema struct', async (t) => {
	let data = await bonApp._cafe(STAV)
	t.notThrows(() => CafeInfoResponseSchema.parse(data))
})

test('fetching menu info should not throw', async (t) => {
	await t.notThrowsAsync(() => bonApp._menu(STAV))
})

test('fetching menu info should return a CafeMenuResponseSchema struct', async (t) => {
	let data = await bonApp._menu(STAV)
	t.notThrows(() => CafeMenuResponseSchema.parse(data))
})
