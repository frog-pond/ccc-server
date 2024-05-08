import {suite, test} from 'node:test'
import assert from 'node:assert/strict'
import lodash from 'lodash'

import * as menu from './menu.js'
import {
	CafeInfoResponseSchema,
	CafeMenuResponseSchema,
} from '../../menus-bonapp/types.js'

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
		test(`${cafe} cafe endpoint should return a BamcoCafeInfo struct`, async () => {
			let ctx = {cacheControl: noop, body: null}
			await assert.doesNotReject(() => cafeInfoFunctions[cafe](ctx))
			assert.doesNotThrow(() => CafeInfoResponseSchema.parse(ctx.body))
		})

		test(`${cafe} menu endpoint should return a CafeMenu struct`, async () => {
			let ctx = {cacheControl: noop, body: null}
			await assert.doesNotReject(() => cafeMenuFunctions[cafe](ctx))
			assert.doesNotThrow(() => CafeMenuResponseSchema.parse(ctx.body))
		})
	}
})
