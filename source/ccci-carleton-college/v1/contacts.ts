import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'

const ContactSchema = z.object({
	title: z.string(),
	phoneNumber: z.string(),
	buttonText: z.string(),
	category: z.string(),
	image: z.string().optional(),
	synopsis: z.string(),
	text: z.string(),
})

const ResponseSchema = z.object({
	data: ContactSchema.array(),
})

export async function getContacts() {
	return ResponseSchema.parse(await get(GH_PAGES('contact-info.json')).json())
}

export const getContactsRoute = createRouteSpec({
	method: 'get',
	path: '/contacts',
	validate: {response: ResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getContacts()
	},
})
