import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(getJson, {maxAge: ONE_HOUR})

export function getBus() {
	return GET(GH_PAGES('bus-times.json'))
}

export async function bus(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getBus()
}

export function getModes() {
	return GET(GH_PAGES('transportation.json'))
}

export async function modes(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getModes()
}
