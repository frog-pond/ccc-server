import {get, ONE_HOUR} from '../../ccc-lib/index.js'
import mem from 'memoize'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = 'https://carls-app.github.io/map-data/'

export function getMap() {
	return GET(url + 'map.json').json()
}

export async function map(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMap()
}

export function getGeojsonMap() {
	return GET(url + 'map.geojson').json()
}

export async function geojson(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getGeojsonMap()
}
