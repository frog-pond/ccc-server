import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'

export const ColorPrintersResponseSchema = z.object({
	data: z.object({
		colorPrinters: z.array(z.string()),
	}),
})

export async function getColorPrinters() {
	return ColorPrintersResponseSchema.parse(await get(GH_PAGES('color-printers.json')).json())
}

export const getColorPrintersRoute = createRouteSpec({
	method: 'get',
	path: '/printing/color-printers',
	validate: {response: ColorPrintersResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getColorPrinters()
	},
})
