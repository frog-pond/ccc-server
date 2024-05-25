import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'

const ColorSchema = z.union([
	z.string().regex(/^#[a-f0-9]{3,6}/i),
	z.tuple([z.number().int(), z.number().int(), z.number().int()]),
])

const WebcamSchema = z.object({
	name: z.string(),
	pageUrl: z.string().url(),
	streamUrl: z.string().url(),
	thumbnail: z.string(),
	tagline: z.string(),
	accentColor: ColorSchema,
	textColor: ColorSchema,
})

const ResponseSchema = z.object({
	data: WebcamSchema.array(),
})

export async function getWebcams() {
	return ResponseSchema.parse(await get(GH_PAGES('webcams.json')).json())
}

export const getWebcamsRoute = createRouteSpec({
	method: 'get',
	path: '/webcams',
	validate: {response: ResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getWebcams()
	},
})
