import {get} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('contact-info.json')

export function getContacts() {
	return GET(url).json()
}

export async function contacts(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getContacts()
}
