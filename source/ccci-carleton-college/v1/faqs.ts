import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

export async function faqs(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getJson(GH_PAGES('faqs.json'))
}
