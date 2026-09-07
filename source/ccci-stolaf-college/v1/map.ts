import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {GH_PAGES_FROM_REPO} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

// Scraped from the college's ArcGIS services and published to GitHub Pages by
// StoDevX/campus-map-data, in the same schema carls-app/map-data uses for
// Carleton — so this is deliberately the Carleton module with a different URL,
// not a second way of doing the same job.
const MAP_REPO = 'campus-map-data'

export async function map(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson(GH_PAGES_FROM_REPO(MAP_REPO, 'map.json'))
}

export async function geojson(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson(GH_PAGES_FROM_REPO(MAP_REPO, 'map.geojson'))
}
