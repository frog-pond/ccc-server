import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'

type DictionaryType = z.infer<typeof DictionarySchema>
const DictionarySchema = z.object({
	data: z.array(
		z.object({
			word: z.string(),
			definition: z.string(),
		}),
	),
})

export async function getDictionary(): Promise<DictionaryType> {
	return DictionarySchema.parse(await get(GH_PAGES('dictionary-carls.json')).json())
}

export const getDictionaryRoute = createRouteSpec({
	method: 'get',
	path: '/dictionary',
	validate: {response: DictionarySchema},
	handler: async (ctx) => {
		ctx.body = await getDictionary()
	},
})
