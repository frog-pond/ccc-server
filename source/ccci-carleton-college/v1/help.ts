import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {HelpResponseSchema} from '../../ccc-frog-pond/help.js'

export async function getHelp() {
	return HelpResponseSchema.parse(await get(GH_PAGES('help.json')).json())
}

export const getHelpRoute = createRouteSpec({
	method: 'get',
	path: '/tools/help',
	validate: {response: HelpResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getHelp()
	},
})
