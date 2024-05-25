import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'

const DictionarySchema = z.object({
	word: z.string(),
	definition: z.string(),
})

const ResponseSchema = z.object({
	data: DictionarySchema.array(),
})

export async function getDictionary() {
	return ResponseSchema.parse(await get(GH_PAGES('dictionary-carls.json')).json())
}

export const getDictionaryRoute = createRouteSpec({
	method: 'get',
	path: '/dictionary',
	validate: {response: ResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getDictionary()
	},
})
