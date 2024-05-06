import {suite, test} from 'node:test'
import assert from 'node:assert/strict'

import * as bonApp from './index.js'
import {BamcoCafeInfo, CafeMenu} from './types.js'

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

suite('cafe info', {concurrency: true}, () => {
	test('fetching the data should not throw', async () => {
		await assert.doesNotReject(() => bonApp._cafe(STAV))
	})

	test('it should return a BamcoCafeInfo struct', async () => {
		let data = await bonApp._cafe(STAV)
		assert.doesNotThrow(() => BamcoCafeInfo.parse(data))
	})
})

suite('menu info', {concurrency: true}, () => {
	test('fetching the data should not throw', async () => {
		await assert.doesNotReject(() => bonApp._menu(STAV))
	})

	test('it should return a CafeMenu struct', async () => {
		let data = await bonApp._menu(STAV)
		assert.doesNotThrow(() => CafeMenu.parse(data))
	})
})
