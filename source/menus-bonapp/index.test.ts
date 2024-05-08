import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import * as bonApp from './index.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.js'

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

void describe('cafe info', {concurrency: true}, () => {
	void it('fetching the data should not throw', async () => {
		await assert.doesNotReject(() => bonApp._cafe(STAV))
	})

	void it('it should return a CafeInfoResponseSchema struct', async () => {
		let data = await bonApp._cafe(STAV)
		assert.doesNotThrow(() => CafeInfoResponseSchema.parse(data))
	})
})

void describe('menu info', {concurrency: true}, () => {
	void it('fetching the data should not throw', async () => {
		await assert.doesNotReject(() => bonApp._menu(STAV))
	})

	void it('it should return a CafeMenuResponseSchema struct', async () => {
		let data = await bonApp._menu(STAV)
		assert.doesNotThrow(() => CafeMenuResponseSchema.parse(data))
	})
})
