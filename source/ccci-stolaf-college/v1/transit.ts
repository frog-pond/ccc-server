import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {BusTimesResponseSchema, TransitModesResponseSchema} from '../../ccc-frog-pond/transit.js'

export async function getBus() {
	return BusTimesResponseSchema.parse(await get(GH_PAGES('bus-times.json')).json())
}

export const getBusTimesRoute = createRouteSpec({
	method: 'get',
	path: '/transit/bus',
	validate: {
		response: BusTimesResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getBus()
	},
})

export async function getTransitModes() {
	return TransitModesResponseSchema.parse(await get(GH_PAGES('transportation.json')).json())
}

export const getTransitModesRoute = createRouteSpec({
	method: 'get',
	path: '/transit/modes',
	validate: {
		response: TransitModesResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getTransitModes()
	},
})
