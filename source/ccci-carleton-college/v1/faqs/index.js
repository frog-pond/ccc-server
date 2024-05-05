import {get, ONE_HOUR} from '../../../ccc-lib/index.js'
import mem from 'memoize'
import {GH_PAGES} from '../gh-pages.js'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('faqs.json')

export function getFaqs() {
	return GET(url).json()
}

export async function faqs(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getFaqs()
}
