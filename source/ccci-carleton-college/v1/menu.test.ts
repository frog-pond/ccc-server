import {test} from 'node:test'
import {noop} from 'lodash-es'

import * as menu from './menu.ts'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from '../../menus-bonapp/types.ts'
import type {Context} from '../../ccc-server/context.ts'
import {keysOf} from '../../ccc-lib/keysOf.ts'

const cafeInfoFunctions: Record<keyof typeof menu.CAFE_URLS, (c: Context) => Promise<unknown>> = {
	stav: menu.stavCafe,
	cage: menu.cageCafe,
	kingsRoom: menu.kingsRoomCafe,
	cave: menu.caveCafe,
	burton: menu.burtonCafe,
	ldc: menu.ldcCafe,
	sayles: menu.saylesCafe,
	weitz: menu.weitzCafe,
	schulze: menu.schulzeCafe,
} as const

const cafeMenuFunctions: Record<keyof typeof menu.CAFE_URLS, (c: Context) => Promise<unknown>> = {
	stav: menu.stavMenu,
	cage: menu.cageMenu,
	kingsRoom: menu.kingsRoomMenu,
	cave: menu.caveMenu,
	burton: menu.burtonMenu,
	ldc: menu.ldcMenu,
	sayles: menu.saylesMenu,
	weitz: menu.weitzMenu,
	schulze: menu.schulzeMenu,
} as const

void test('cafe endpoints', {concurrency: true}, (t) => {
	for (const cafe of keysOf(menu.CAFE_URLS)) {
		void t.test(`${cafe} should return a BamcoCafeInfo`, {timeout: 15_000}, async (t) => {
			const ctx = {cacheControl: noop, body: null} as Context
			await t.assert.doesNotReject(cafeInfoFunctions[cafe](ctx))
			t.assert.doesNotThrow(() => CafeInfoResponseSchema.parse(ctx.body))
		})
	}
})

void test('menu endpoints', {concurrency: true}, (t) => {
	for (const cafe of keysOf(menu.CAFE_URLS)) {
		void t.test(`${cafe} should return a CafeMenu`, {timeout: 15_000}, async (t) => {
			const ctx = {cacheControl: noop, body: null} as Context
			await t.assert.doesNotReject(cafeMenuFunctions[cafe](ctx))
			t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(ctx.body))
		})
	}
})
