import {get} from '../../ccc-lib/http.js'
import {MAP_DATA} from './gh-pages.js'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'
import {GeoJSONSchema} from 'zod-geojson'

const MapSchema = z.record(z.string(), z.unknown())

export async function getMap() {
	return MapSchema.parse(await get(MAP_DATA('map.json')).json())
}

export const getMapRoute = createRouteSpec({
	method: 'get',
	path: '/map',
	validate: {response: MapSchema},
	handler: async (ctx) => {
		ctx.body = await getMap()
	},
})

export async function getGeoJson() {
	return GeoJSONSchema.parse(await get(MAP_DATA('map.geojson')).json())
}

export const getMapGeoJsonRoute = createRouteSpec({
	method: 'get',
	path: '/map/geojson',
	validate: {response: GeoJSONSchema},
	handler: async (ctx) => {
		ctx.body = await getGeoJson()
	},
})
