import {getJson} from '../../ccc-lib/http.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function map(c: Context) {
	return c.json(await getJson('https://carls-app.github.io/map-data/map.json'))
}

export async function geojson(c: Context) {
	return c.json(await getJson('https://carls-app.github.io/map-data/map.geojson'))
}
