import {get} from '../../ccc-lib/http.js'
import {ONE_DAY, ONE_HOUR} from '../../ccc-lib/constants.js'
import * as bonapp from '../../menus-bonapp/index.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'

const pauseMenuUrl = GH_PAGES('pause-menu.json')
const GET_DAY = mem(get, {maxAge: ONE_DAY})
export const getPauseMenu = () => GET_DAY(pauseMenuUrl).json()

const getMenu = mem(bonapp.menu, {maxAge: ONE_HOUR})
const getInfo = mem(bonapp.cafe, {maxAge: ONE_HOUR})
const getNutrition = mem(bonapp.nutrition, {maxAge: ONE_HOUR})

export const getCafe = (cafeId) =>
	Promise.all([getMenu(cafeId), getInfo(cafeId)])

let cafeUrls = {
	stav: 'https://stolaf.cafebonappetit.com/cafe/stav-hall/',
	cage: 'https://stolaf.cafebonappetit.com/cafe/the-cage/',
	kingsRoom: 'https://stolaf.cafebonappetit.com/cafe/the-kings-room/',
	cave: 'https://stolaf.cafebonappetit.com/cafe/the-cave/',
	burton: 'https://carleton.cafebonappetit.com/cafe/burton/',
	ldc: 'https://carleton.cafebonappetit.com/cafe/east-hall/',
	sayles: 'https://carleton.cafebonappetit.com/cafe/sayles-cafe/',
	weitz: 'https://carleton.cafebonappetit.com/cafe/weitz-cafe/',
	schulze: 'https://carleton.cafebonappetit.com/cafe/schulze-cafe/',
}

let cafeIdToUrl = {
	261: 'stav',
	262: 'cage',
	263: 'kingsRoom',
	35: 'burton',
	36: 'ldc',
	34: 'sayles',
	458: 'weitz',
}

export async function pauseMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getPauseMenu()
}

export async function bonAppMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls[cafeIdToUrl[ctx.params.cafeId]])
}

export async function bonAppCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls[cafeIdToUrl[ctx.params.cafeId]])
}

export async function bonAppNutrition(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getNutrition(ctx.params.itemId)
}

export async function stavCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.stav)
}

export async function stavMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.stav)
}

export async function cageCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.cage)
}

export async function cageMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.cage)
}

export async function kingsRoomCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.kingsRoom)
}

export async function kingsRoomMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.kingsRoom)
}

export async function caveCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.cave)
}

export async function caveMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.cave)
}

export async function burtonCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.burton)
}

export async function burtonMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.burton)
}

export async function ldcCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.ldc)
}

export async function ldcMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.ldc)
}

export async function saylesCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.sayles)
}

export async function saylesMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.sayles)
}

export async function weitzCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.weitz)
}

export async function weitzMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.weitz)
}

export async function schulzeCafe(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getInfo(cafeUrls.schulze)
}

export async function schulzeMenu(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMenu(cafeUrls.schulze)
}
