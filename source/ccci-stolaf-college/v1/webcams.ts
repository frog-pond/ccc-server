import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(getJson, {maxAge: ONE_DAY})

let url = GH_PAGES('webcams.json')

export function getWebcams() {
	return GET(url)
}

export async function webcams(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getWebcams()
}
