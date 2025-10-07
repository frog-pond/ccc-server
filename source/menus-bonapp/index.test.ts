import {test, expect} from 'vitest'

import * as bonApp from './index.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.js'

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

test('fetching cafe info should not throw', async () => {
	await expect(bonApp._cafe(STAV)).resolves.not.toThrow()
})

test('fetching cafe info should return a CafeInfoResponseSchema struct', async () => {
	const data = await bonApp._cafe(STAV)
	expect(() => CafeInfoResponseSchema.parse(data)).not.toThrow()
})

test('fetching menu info should not throw', async () => {
	await expect(bonApp._menu(STAV)).resolves.not.toThrow()
})

test('fetching menu info should return a CafeMenuResponseSchema struct', async () => {
	const data = await bonApp._menu(STAV)
	expect(() => CafeMenuResponseSchema.parse(data)).not.toThrow()
})
