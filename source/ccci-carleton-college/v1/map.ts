import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(getJson, {maxAge: ONE_HOUR})

let url = 'https://carls-app.github.io/map-data/'

export function getMap() {
	return GET(url + 'map.json')
}

export async function map(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getMap()
}

export function getGeojsonMap() {
	return GET(url + 'map.geojson')
}

export async function geojson(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getGeojsonMap()
}
