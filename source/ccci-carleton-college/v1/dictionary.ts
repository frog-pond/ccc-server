import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {DictionaryResponseSchema} from '../../ccc-frog-pond/dictionary.js'

export async function getDictionary() {
	return DictionaryResponseSchema.parse(await get(GH_PAGES('dictionary-carls.json')).json())
}

export const getDictionaryRoute = createRouteSpec({
	method: 'get',
	path: '/dictionary',
	validate: {response: DictionaryResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getDictionary()
	},
})
