import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'

const getBus = mem(async () => {
	const response = await get(GH_PAGES('bus-times.json'))
	return response.json()
}, {maxAge: ONE_HOUR})

export async function bus(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getBus()
}

const getModes = mem(async () => {
	const response = await get(GH_PAGES('transportation.json'))
	return response.json()
}, {maxAge: ONE_HOUR})

export async function modes(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getModes()
}
