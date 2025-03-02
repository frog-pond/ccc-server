import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'

const getFaqs = mem(
	async () => {
		const response = await get(GH_PAGES('faqs.json'))
		return response.clone().json()
	},
	{maxAge: ONE_DAY},
)

export async function faqs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getFaqs()
}
