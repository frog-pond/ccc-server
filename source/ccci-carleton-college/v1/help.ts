import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('help.json')

export function getHelp() {
	return GET(url).json()
}

export async function help(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getHelp()
}
