import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'

const GET = mem(get, {maxAge: ONE_DAY})

let url = GH_PAGES('webcams.json')

export async function getWebcams() {
	const response = await GET(url)
	return response.clone().json()
}

export async function webcams(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getWebcams()
}
