import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {FaqsSchema} from '../../ccc-frog-pond/faqs.js'

export async function getFaqs() {
	return FaqsSchema.parse(await get(GH_PAGES('faqs.json')).json())
}

export const getFaqsRoute = createRouteSpec({
	method: 'get',
	path: '/faqs',
	validate: {response: FaqsSchema},
	handler: async (ctx) => {
		ctx.body = await getFaqs()
	},
})
