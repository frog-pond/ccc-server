import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const getDictionary = mem(
	async () => {
		const response = await getJson(GH_PAGES('dictionary.json'))
		return response
	},
	{maxAge: ONE_DAY},
)

export async function dictionary(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getDictionary()
}
