import {suite, test} from 'node:test'
import assert from 'node:assert/strict'
import lodash from 'lodash'

import * as menu from './menu.js'

const {noop} = lodash

const cafeInfoFunctions = {
	stav: menu.stavCafe,
	cage: menu.cageCafe,
	kingsRoom: menu.kingsRoomCafe,
	cave: menu.caveCafe,
	burton: menu.burtonCafe,
	ldc: menu.ldcCafe,
	sayles: menu.saylesCafe,
	weitz: menu.weitzCafe,
	schulze: menu.schulzeCafe,
}

const cafeMenuFunctions = {
	stav: menu.stavMenu,
	cage: menu.cageMenu,
	kingsRoom: menu.kingsRoomMenu,
	cave: menu.caveMenu,
	burton: menu.burtonMenu,
	ldc: menu.ldcMenu,
	sayles: menu.saylesMenu,
	weitz: menu.weitzMenu,
	schulze: menu.schulzeMenu,
}

suite('sanity checks', () => {
	test('all cafe info endpoints are represented in this test file', () => {
		assert.deepStrictEqual(
			Object.keys(cafeInfoFunctions),
			Object.keys(menu.CAFE_URLS),
		)
	})

	test('all cafe menu endpoints are represented in this test file', () => {
		assert.deepStrictEqual(
			Object.keys(cafeMenuFunctions),
			Object.keys(menu.CAFE_URLS),
		)
	})
})

suite('endpoints should not throw', {concurrency: 4}, () => {
	for (const cafe of Object.keys(menu.CAFE_URLS)) {
		test(`${cafe} cafe endpoint should not throw`, async () => {
			await assert.doesNotReject(() =>
				cafeInfoFunctions[cafe]({cacheControl: noop, body: null}),
			)
		})

		test(`${cafe} menu endpoint should not throw`, async () => {
			await assert.doesNotReject(() =>
				cafeMenuFunctions[cafe]({cacheControl: noop, body: null}),
			)
		})
	}
})
