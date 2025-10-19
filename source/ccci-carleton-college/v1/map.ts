import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

export async function map(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson('https://carls-app.github.io/map-data/map.json')
}

export async function geojson(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson('https://carls-app.github.io/map-data/map.geojson')
}
