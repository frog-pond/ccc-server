import {get} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('webcams.json')

export function getWebcams() {
	return GET(url).json()
}

export async function webcams(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getWebcams()
}
