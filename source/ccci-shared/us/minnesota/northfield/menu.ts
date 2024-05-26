import mem from 'memoize'
import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'
import {get} from '../../../../ccc-lib/http.js'
import {ONE_DAY, ONE_HOUR} from '../../../../ccc-lib/constants.js'
import * as bonapp from '../../../../menus-bonapp/index.js'
import {CafeInfoResponseSchema, CafeMenuResponseSchema, PauseMenuSchema} from '../../../../menus-bonapp/types.js'
import {GH_PAGES} from '../../../../ccci-stolaf-college/v1/gh-pages.js'

const pauseMenuUrl = GH_PAGES('pause-menu.json')
const GET_DAY = mem(get, {maxAge: ONE_DAY})
export const getPauseMenu = async () => PauseMenuSchema.parse(await GET_DAY(pauseMenuUrl).json())

const getMenu = mem(bonapp.menu, {maxAge: ONE_HOUR})
const getInfo = mem(bonapp.cafe, {maxAge: ONE_HOUR})
const getNutrition = mem(bonapp.nutrition, {maxAge: ONE_HOUR})

type BamcoCafeSlugs = z.infer<typeof BamcoCafeSlugs>
export const BamcoCafeSlugs = z.union([
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

export const AllKnownCafeSlugs = BamcoCafeSlugs.or(z.literal('the-pause'))

export const BamcoSlugToUrl = {
	'stav-hall': 'https://stolaf.cafebonappetit.com/cafe/stav-hall/',
	'the-cage': 'https://stolaf.cafebonappetit.com/cafe/the-cage/',
	'kings-room': 'https://stolaf.cafebonappetit.com/cafe/the-kings-room/',
	'the-cave': 'https://stolaf.cafebonappetit.com/cafe/the-cave/',
	'c-store': 'https://stolaf.cafebonappetit.com/cafe/the-cave/', // alias for "the-cave"
	burton: 'https://carleton.cafebonappetit.com/cafe/burton/',
	ldc: 'https://carleton.cafebonappetit.com/cafe/east-hall/',
	sayles: 'https://carleton.cafebonappetit.com/cafe/sayles-cafe/',
	weitz: 'https://carleton.cafebonappetit.com/cafe/weitz-cafe/',
	schulze: 'https://carleton.cafebonappetit.com/cafe/schulze-cafe/',
} as const satisfies Record<BamcoCafeSlugs, string>

// I don't like having to maintain this lookup table twice, but this way TS guarantees
// that both copies of the table have the same entries.
const BamcoSlugToId = {
	'stav-hall': '261',
	'the-cage': '262',
	'kings-room': '263',
	sayles: '34',
	burton: '35',
	ldc: '36',
	weitz: '458',
} as const satisfies Partial<Record<BamcoCafeSlugs, string>>

const KnownCafeIdEnum = z.nativeEnum(BamcoSlugToId)
type KnownCafeIdEnum = z.infer<typeof KnownCafeIdEnum> // "apple" | "banana" | 3

export const BamcoIdToSlug: Record<KnownCafeIdEnum, BamcoCafeSlugs> = {
	'261': 'stav-hall',
	'262': 'the-cage',
	'263': 'kings-room',
	'35': 'burton',
	'36': 'ldc',
	'34': 'sayles',
	'458': 'weitz',
} as const

export const getNamedMenuRoute = createRouteSpec({
	method: 'get',
	path: '/food/named/menu/:cafeName',
	validate: {
		params: z.object({cafeName: AllKnownCafeSlugs}),
		response: CafeMenuResponseSchema.or(PauseMenuSchema),
	},
	handler: async (ctx) => {
		if (ctx.request.params.cafeName === 'the-pause') {
			ctx.body = await getPauseMenu()
		} else {
			ctx.body = await getMenu(BamcoSlugToUrl[ctx.request.params.cafeName])
		}
	},
})

export const getNamedCafeRoute = createRouteSpec({
	method: 'get',
	path: '/food/named/cafe/:cafeName',
	validate: {
		params: z.object({cafeName: BamcoCafeSlugs}),
		response: CafeInfoResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getInfo(BamcoSlugToUrl[ctx.request.params.cafeName])
	},
})

export const getBonAppMenuRoute = createRouteSpec({
	method: 'get',
	path: '/food/menu/:cafeId',
	validate: {
		params: z.object({cafeId: KnownCafeIdEnum}),
	},
	handler: async (ctx) => {
		let cafeName = BamcoIdToSlug[ctx.request.params.cafeId]
		ctx.body = await getMenu(BamcoSlugToUrl[cafeName])
	},
})

export const getBonAppCafeRoute = createRouteSpec({
	method: 'get',
	path: '/food/cafe/:cafeId',
	validate: {
		params: z.object({cafeId: KnownCafeIdEnum}),
	},
	handler: async (ctx) => {
		let cafeName = BamcoIdToSlug[ctx.request.params.cafeId]
		ctx.body = await getInfo(BamcoSlugToUrl[cafeName])
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
