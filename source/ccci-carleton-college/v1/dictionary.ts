import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('dictionary-carls.json')

export function getDictionary() {
	return GET(url).json()
}

export async function dictionary(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getDictionary()
}
