import {getJson} from '../../ccc-lib/http.ts'
import * as bonapp from '../../menus-bonapp/index.ts'
import {bonAppJson} from '../../menus-bonapp/response.ts'
import {GH_PAGES} from './gh-pages.ts'
import {requireQuery} from '../../ccc-worker/query.ts'
import type {Context} from '../../ccc-worker/env.ts'
import {HTTPException} from 'hono/http-exception'

const pauseMenuUrl = GH_PAGES('pause-menu.json')
export const getPauseMenu = () => getJson(pauseMenuUrl)

const getMenu = bonapp.menu
const getInfo = bonapp.cafe
const getNutrition = bonapp.nutrition

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

function requireCafeUrl(c: Context) {
	let cafeId = requireQuery(c, 'cafeId')
	if (!isKeyofCafeIdToUrl(cafeId)) {
		throw new HTTPException(400, {
			message: `?cafeId must be one of ${Object.values(CAFE_ID_TO_URL).join(', ')}`,
		})
	}
	return CAFE_URLS[CAFE_ID_TO_URL[cafeId]]
}

export async function pauseMenu(c: Context) {
	return c.json(await getPauseMenu())
}

export async function bonAppMenu(c: Context) {
	return bonAppJson(c, await getMenu(requireCafeUrl(c)))
}

export async function bonAppCafe(c: Context) {
	return bonAppJson(c, await getInfo(requireCafeUrl(c)))
}

export async function bonAppNutrition(c: Context) {
	return c.json(await getNutrition(requireQuery(c, 'itemId')))
}

export async function stavCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.stav))
}

export async function stavMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.stav))
}

export async function cageCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.cage))
}

export async function cageMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.cage))
}

export async function kingsRoomCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.kingsRoom))
}

export async function kingsRoomMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.kingsRoom))
}

export async function caveCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.cave))
}

export async function caveMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.cave))
}

export async function burtonCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.burton))
}

export async function burtonMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.burton))
}

export async function ldcCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.ldc))
}

export async function ldcMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.ldc))
}

export async function saylesCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.sayles))
}

export async function saylesMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.sayles))
}

export async function weitzCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.weitz))
}

export async function weitzMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.weitz))
}

export async function schulzeCafe(c: Context) {
	return bonAppJson(c, await getInfo(CAFE_URLS.schulze))
}

export async function schulzeMenu(c: Context) {
	return bonAppJson(c, await getMenu(CAFE_URLS.schulze))
}
