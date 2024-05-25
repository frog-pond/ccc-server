import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('contact-info.json')

export function getContacts() {
	return GET(url).json()
}

export async function contacts(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getContacts()
}
