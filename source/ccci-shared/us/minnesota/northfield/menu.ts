import mem from 'memoize'
import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'
import {get} from '../../../../ccc-lib/http.js'
import {ONE_DAY, ONE_HOUR} from '../../../../ccc-lib/constants.js'
import * as bonapp from '../../../../menus-bonapp/index.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from '../../../../menus-bonapp/types.js'
import {GH_PAGES} from '../../../../ccci-stolaf-college/v1/gh-pages.js'

const pauseMenuUrl = GH_PAGES('pause-menu.json')
const GET_DAY = mem(get, {maxAge: ONE_DAY})
export const getPauseMenu = async () =>
	CafeMenuResponseSchema.parse(await GET_DAY(pauseMenuUrl).json())

const getMenu = mem(bonapp.menu, {maxAge: ONE_HOUR})
const getInfo = mem(bonapp.cafe, {maxAge: ONE_HOUR})
const getNutrition = mem(bonapp.nutrition, {maxAge: ONE_HOUR})

type BONAPP_CAFE_NAMES_TYPE = z.infer<typeof BONAPP_CAFE_NAMES>
export const BONAPP_CAFE_NAMES = z.union([
	z.literal('stav-hall'),
	z.literal('the-cage'),
	z.literal('kings-room'),
	z.literal('the-cave'),
	z.literal('c-store'),
	z.literal('burton'),
	z.literal('ldc'),
	z.literal('sayles'),
	z.literal('weitz'),
	z.literal('schulze'),
])

export const CAFE_NAMES = BONAPP_CAFE_NAMES.or(z.literal('the-pause'))

export const CAFE_URLS: Record<BONAPP_CAFE_NAMES_TYPE, string> = {
	'stav-hall': 'https://stolaf.cafebonappetit.com/cafe/stav-hall/',
	'the-cage': 'https://stolaf.cafebonappetit.com/cafe/the-cage/',
	'kings-room': 'https://stolaf.cafebonappetit.com/cafe/the-kings-room/',
	'the-cave': 'https://stolaf.cafebonappetit.com/cafe/the-cave/',
	'c-store': 'https://stolaf.cafebonappetit.com/cafe/the-cave/', // alias for "cave"
	burton: 'https://carleton.cafebonappetit.com/cafe/burton/',
	ldc: 'https://carleton.cafebonappetit.com/cafe/east-hall/',
	sayles: 'https://carleton.cafebonappetit.com/cafe/sayles-cafe/',
	weitz: 'https://carleton.cafebonappetit.com/cafe/weitz-cafe/',
	schulze: 'https://carleton.cafebonappetit.com/cafe/schulze-cafe/',
} as const

export const CAFE_ID_TO_URL: Record<number, keyof typeof CAFE_URLS> = {
	261: 'stav-hall',
	262: 'the-cage',
	263: 'kings-room',
	35: 'burton',
	36: 'ldc',
	34: 'sayles',
	458: 'weitz',
} as const

export const getNamedMenuRoute = createRouteSpec({
	method: 'get',
	path: '/food/named/menu/:cafeName',
	validate: {
		params: z.object({cafeName: CAFE_NAMES}),
		response: CafeMenuResponseSchema,
	},
	handler: async (ctx) => {
		if (ctx.request.params.cafeName === 'the-pause') {
			ctx.body = await getPauseMenu()
		} else {
			ctx.body = await getMenu(CAFE_URLS[ctx.request.params.cafeName])
		}
	},
})

export const getNamedCafeRoute = createRouteSpec({
	method: 'get',
	path: '/food/named/cafe/:cafeName',
	validate: {
		params: z.object({cafeName: BONAPP_CAFE_NAMES}),
		response: CafeInfoResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getInfo(CAFE_URLS[ctx.request.params.cafeName])
	},
})

export const getBonAppMenuRoute = createRouteSpec({
	method: 'get',
	path: '/food/menu/:cafeId',
	validate: {
		params: z.object({cafeId: z.coerce.number()}),
	},
	handler: async (ctx) => {
		let cafeName = CAFE_ID_TO_URL[ctx.request.params.cafeId]
		if (!cafeName) {
			ctx.throw()
			return
		}
		ctx.body = await getMenu(CAFE_URLS[cafeName])
	},
})

export const getBonAppCafeRoute = createRouteSpec({
	method: 'get',
	path: '/food/cafe/:cafeId',
	validate: {
		params: z.object({cafeId: z.coerce.number()}),
	},
	handler: async (ctx) => {
		let cafeName = CAFE_ID_TO_URL[ctx.request.params.cafeId]
		if (!cafeName) {
			ctx.throw()
			return
		}
		ctx.body = await getInfo(CAFE_URLS[cafeName])
	},
})

export const getBonAppItemNutritionRoute = createRouteSpec({
	method: 'get',
	path: '/food/item/:itemId',
	validate: {
		params: z.object({itemId: z.string()}),
	},
	handler: async (ctx) => {
		ctx.body = await getNutrition(ctx.request.params.itemId)
	},
})
