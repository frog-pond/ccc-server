import {get, ONE_HOUR} from '../../ccc-lib/index.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('dictionary-carls.json')

export function getDictionary() {
	return GET(url).json()
}

export async function dictionary(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getDictionary()
}
