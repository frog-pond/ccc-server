import {test, expect} from 'vitest'

import * as bonApp from './index.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.js'

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

test('fetching cafe info should not throw', {timeout: 15_000}, async () => {
	await expect(bonApp._cafe(STAV)).resolves.not.toThrow()
})

test(
	'fetching cafe info should return a CafeInfoResponseSchema struct',
	{timeout: 15_000},
	async () => {
		const data = await bonApp._cafe(STAV)
		expect(() => CafeInfoResponseSchema.parse(data)).not.toThrow()
	},
)

test('fetching menu info should not throw', {timeout: 15_000}, async () => {
	await expect(bonApp._menu(STAV)).resolves.not.toThrow()
})

test(
	'fetching menu info should return a CafeMenuResponseSchema struct',
	{timeout: 15_000},
	async () => {
		const data = await bonApp._menu(STAV)
		expect(() => CafeMenuResponseSchema.parse(data)).not.toThrow()
	},
)
