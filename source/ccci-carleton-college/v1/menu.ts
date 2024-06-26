import {get} from '../../ccc-lib/http.js'
import {ONE_DAY, ONE_HOUR} from '../../ccc-lib/constants.js'
import * as bonapp from '../../menus-bonapp/index.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'

const pauseMenuUrl = GH_PAGES('pause-menu.json')
const GET_DAY = mem(get, {maxAge: ONE_DAY})
export const getPauseMenu = () => GET_DAY(pauseMenuUrl).json()

const getMenu = mem(bonapp.menu, {maxAge: ONE_HOUR})
const getInfo = mem(bonapp.cafe, {maxAge: ONE_HOUR})
const getNutrition = mem(bonapp.nutrition, {maxAge: ONE_HOUR})

export const CAFE_URLS = {
	stav: 'https://stolaf.cafebonappetit.com/cafe/stav-hall/',
	cage: 'https://stolaf.cafebonappetit.com/cafe/the-cage/',
	kingsRoom: 'https://stolaf.cafebonappetit.com/cafe/the-kings-room/',
	cave: 'https://stolaf.cafebonappetit.com/cafe/the-cave/',
	burton: 'https://carleton.cafebonappetit.com/cafe/burton/',
	ldc: 'https://carleton.cafebonappetit.com/cafe/east-hall/',
	sayles: 'https://carleton.cafebonappetit.com/cafe/sayles-cafe/',
	weitz: 'https://carleton.cafebonappetit.com/cafe/weitz-cafe/',
	schulze: 'https://carleton.cafebonappetit.com/cafe/schulze-cafe/',
} as const

export const CAFE_ID_TO_URL = {
	261: 'stav',
	262: 'cage',
	263: 'kingsRoom',
	35: 'burton',
	36: 'ldc',
	34: 'sayles',
	458: 'weitz',
} as const

function isKeyofCafeIdToUrl(s: string | number): s is keyof typeof CAFE_ID_TO_URL {
	return s in CAFE_ID_TO_URL
}

export async function pauseMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getPauseMenu()
}

export async function bonAppMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	let cafeId = ctx.URL.searchParams.get('cafeId')
	ctx.assert(cafeId, 400, '?cafeId is required')
	ctx.assert(
		isKeyofCafeIdToUrl(cafeId),
		400,
		`?cafeId must be one of ${Object.values(CAFE_ID_TO_URL).join(', ')}`,
	)
	ctx.body = await getMenu(CAFE_URLS[CAFE_ID_TO_URL[cafeId]])
}

export async function bonAppCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	let cafeId = ctx.URL.searchParams.get('cafeId')
	ctx.assert(cafeId, 400, '?cafeId is required')
	ctx.assert(
		isKeyofCafeIdToUrl(cafeId),
		400,
		`?cafeId must be one of ${Object.values(CAFE_ID_TO_URL).join(', ')}`,
	)
	ctx.body = await getInfo(CAFE_URLS[CAFE_ID_TO_URL[cafeId]])
}

export async function bonAppNutrition(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	let itemId = ctx.URL.searchParams.get('itemId')
	ctx.assert(itemId, 400, '?itemId is required')
	ctx.body = await getNutrition(itemId)
}

export async function stavCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.stav)
}

export async function stavMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.stav)
}

export async function cageCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.cage)
}

export async function cageMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.cage)
}

export async function kingsRoomCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.kingsRoom)
}

export async function kingsRoomMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.kingsRoom)
}

export async function caveCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.cave)
}

export async function caveMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.cave)
}

export async function burtonCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.burton)
}

export async function burtonMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.burton)
}

export async function ldcCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.ldc)
}

export async function ldcMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.ldc)
}

export async function saylesCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.sayles)
}

export async function saylesMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.sayles)
}

export async function weitzCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.weitz)
}

export async function weitzMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.weitz)
}

export async function schulzeCafe(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(CAFE_URLS.schulze)
}

export async function schulzeMenu(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(CAFE_URLS.schulze)
}
