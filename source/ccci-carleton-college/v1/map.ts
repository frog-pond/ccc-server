import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import type {Context} from '../../ccc-server/context.js'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = 'https://carls-app.github.io/map-data/'

export function getMap() {
	return GET(url + 'map.json').json()
}

export async function map(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMap()
}

export function getGeojsonMap() {
	return GET(url + 'map.geojson').json()
}

export async function geojson(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getGeojsonMap()
}
