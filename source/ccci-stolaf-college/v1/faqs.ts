import {get} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const getFaqs = mem(
	async () => {
		const response = await get(GH_PAGES('faqs.json'))
		return response.json()
	},
	{maxAge: ONE_DAY},
)

export async function faqs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getFaqs()
}
