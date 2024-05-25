import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {BuildingHoursResponseSchema} from '../../ccc-frog-pond/building-hours.js'

export async function getBuildingHours() {
	return BuildingHoursResponseSchema.parse(await get(GH_PAGES('building-hours.json')).json())
}

export const getBuildingHoursRoute = createRouteSpec({
	method: 'get',
	path: '/spaces/hours',
	validate: {response: BuildingHoursResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getBuildingHours()
	},
})
