import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const getContacts = mem(
	async () => {
		const response = await getJson(GH_PAGES('contact-info.json'))
		return response
	},
	{maxAge: ONE_DAY},
)

export async function contacts(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getContacts()
}
