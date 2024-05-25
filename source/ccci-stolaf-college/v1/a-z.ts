import {createRouteSpec} from 'koa-zod-router'
import {AToZResponseSchema, combineResponses, getOlafAtoZ} from '../../stolaf-edu/a-to-z.js'
import {AllAboutOlafExtraAzResponseSchema} from '../../ccc-frog-pond/a-to-z.js'
import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'

export async function getPagesAtoZ() {
	return AllAboutOlafExtraAzResponseSchema.parse(await get(GH_PAGES('a-to-z.json')).json())
}

export async function getAToZ() {
	return AToZResponseSchema.parse(await combineResponses(getPagesAtoZ(), getOlafAtoZ()))
}

export const getAToZRoute = createRouteSpec({
	method: 'get',
	path: '/a-to-z',
	validate: {response: AToZResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getAToZ()
	},
})
