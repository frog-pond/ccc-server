import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {WebcamResponseSchema} from '../../ccc-frog-pond/webcams.js'

export async function getWebcams() {
	return WebcamResponseSchema.parse(await get(GH_PAGES('webcams.json')).json())
}

export const getWebcamsRoute = createRouteSpec({
	method: 'get',
	path: '/webcams',
	validate: {response: WebcamResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getWebcams()
	},
})
