import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'

const GET = mem(get, {maxAge: ONE_HOUR})

export function getBus() {
	return GET(GH_PAGES('bus-times.json')).json()
}

export async function bus(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getBus()
}

export function getModes() {
	return GET(GH_PAGES('transportation.json')).json()
}

export async function modes(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getModes()
}