import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'

const GET = mem(get, {maxAge: ONE_DAY})

let url = GH_PAGES('webcams.json')

export function getWebcams() {
	return GET(url).json()
}

export async function webcams(ctx) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getWebcams()
}
