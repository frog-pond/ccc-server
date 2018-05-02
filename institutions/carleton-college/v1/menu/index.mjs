import got from 'got'
import mem from 'mem'

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000
const GET_HOUR = mem(got.get, {maxAge: ONE_HOUR})
const GET_DAY = mem(got.get, {maxAge: ONE_DAY})

const pauseBase = 'https://stodevx.github.io/AAO-React-Native/pause-menu.json'
const menuBase = 'https://legacy.cafebonappetit.com/api/2/menus'
const cafeBase = 'https://legacy.cafebonappetit.com/api/2/cafes'

export const getPauseMenu = () => GET_DAY(pauseBase, {json: true})
export const getCafeMenu = cafeId =>
	GET_HOUR(menuBase, {json: true, query: {cafe: cafeId}})
export const getCafeInfo = cafeId =>
	GET_DAY(cafeBase, {json: true, query: {cafe: cafeId}})
export const getCafe = cafeId =>
	Promise.all([getCafeMenu(cafeId), getCafeInfo(cafeId)])

export const getBonAppMenu(cafeId) => {
	let resp = await getCafeMenu(cafeId)
	let days = resp.body.days.map(dayInfo => {
		let info = Object.assign({}, dayInfo)
		info.cafe = info.cafes[cafeId]
		delete info.cafes
		return info
	})
	return Object.assign(resp.body, {days})
}

export const getBonAppCafe(cafeId) => {
	let resp = await getCafeInfo(cafeId)
	let cafeInfo = resp.body
	cafeInfo.cafe = cafeInfo.cafes[cafeId]
	delete cafeInfo.cafes
	return cafeInfo
}

export async function pauseMenu(ctx) {
	ctx.body = await getPauseMenu().body
}

export async function bonAppMenu(ctx) {
	ctx.body = await getBonAppMenu(ctx.params.cafeId)
}

export async function bonAppCafe(ctx) {
	ctx.body = await getBonAppCafe(ctx.params.cafeId)
}

let cafeIds = {
	stav: 261,
	cage: 262,
	kingsRoom: 263,
	burton: 35,
	ldc: 36,
	sayles: 34,
	weitz: 458,
}

export async function stavCafe(ctx) {
	ctx.body = await getCafeInfo(cafeIds.stav)
}

export async function stavMenu(ctx) {
	ctx.body = await getBonAppMenu(cafeIds.stav)
}

export async function cageCafe(ctx) {
	ctx.body = await getCafeInfo(cafeIds.cage)
}

export async function cageMenu(ctx) {
	ctx.body = await getBonAppMenu(cafeIds.cage)
}

export async function kingsRoomCafe(ctx) {
	ctx.body = await getCafeInfo(cafeIds.kingsRoom)
}

export async function kingsRoomMenu(ctx) {
	ctx.body = await getBonAppMenu(cafeIds.kingsRoom)
}

export async function burtonCafe(ctx) {
	ctx.body = await getCafeInfo(cafeIds.burton)
}

export async function burtonMenu(ctx) {
	ctx.body = await getBonAppMenu(cafeIds.burton)
}

export async function ldcCafe(ctx) {
	ctx.body = await getCafeInfo(cafeIds.ldc)
}

export async function ldcMenu(ctx) {
	ctx.body = await getBonAppMenu(cafeIds.ldc)
}

export async function saylesCafe(ctx) {
	ctx.body = await getCafeInfo(cafeIds.sayles)
}

export async function saylesMenu(ctx) {
	ctx.body = await getBonAppMenu(cafeIds.sayles)
}

export async function weitzCafe(ctx) {
	ctx.body = await getCafeInfo(cafeIds.weitz)
}

export async function weitzMenu(ctx) {
	ctx.body = await getBonAppMenu(cafeIds.weitz)
}
