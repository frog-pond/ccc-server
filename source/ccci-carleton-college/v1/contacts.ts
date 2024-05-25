import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {createRouteSpec} from 'koa-zod-router'
import {ContactResponseSchema} from '../../ccc-frog-pond/contact.js'

export async function getContacts() {
	return ContactResponseSchema.parse(await get(GH_PAGES('contact-info.json')).json())
}

export const getContactsRoute = createRouteSpec({
	method: 'get',
	path: '/contacts',
	validate: {response: ContactResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getContacts()
	},
})
