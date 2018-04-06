import got from 'got'
import mem from 'mem'

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000
const GET_HOUR = mem(got.get, {maxAge: ONE_HOUR})
const GET_DAY = mem(got.get, {maxAge: ONE_DAY})

const pauseBase = 'https://stodevx.github.io/AAO-React-Native/pause-menu.json'
const menuBase = 'http://legacy.cafebonappetit.com/api/2/menus'
const cafeBase = 'http://legacy.cafebonappetit.com/api/2/cafes'

export const getPauseMenu = () => GET_DAY(pauseBase, {json: true})
export const getCafeMenu = (cafeId) => GET_HOUR(menuBase, {json: true, query: {cafe: cafeId}})
export const getCafeInfo = (cafeId) => GET_DAY(cafeBase, {json: true, query: {cafe: cafeId}})
export const getCafe = (cafeId) => Promise.all([getCafeMenu(cafeId), getCafeInfo(cafeId)])

export async function pauseMenu(ctx) {
	let resp = await getPauseMenu()
	ctx.body = resp.body
}

export async function menu(ctx) {
	let {cafeId} = ctx.params
	let resp = await getCafeMenu(cafeId)
	ctx.body = resp.body
}

export async function cafe(ctx) {
	let {cafeId} = ctx.params
	let resp = await getCafeInfo(cafeId)
	ctx.body = resp.body
}
