import {test, expect} from 'vitest'
import {noop} from 'lodash-es'

import * as menu from './menu.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from '../../menus-bonapp/types.js'
import type {Context} from '../../ccc-server/context.js'
import {keysOf} from '../../ccc-lib/keysOf.js'

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

for (const cafe of keysOf(menu.CAFE_URLS)) {
	test(`${cafe} cafe endpoint should return a BamcoCafeInfo struct`, async () => {
		const ctx = {cacheControl: noop, body: null} as Context
		await cafeInfoFunctions[cafe](ctx)
		expect(() => CafeInfoResponseSchema.parse(ctx.body)).not.toThrow()
	})

	test(`${cafe} menu endpoint should return a CafeMenu struct`, async () => {
		const ctx = {cacheControl: noop, body: null} as Context
		await cafeMenuFunctions[cafe](ctx)
		expect(() => CafeMenuResponseSchema.parse(ctx.body)).not.toThrow()
	})
}
