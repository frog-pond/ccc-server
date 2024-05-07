import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {GH_PAGES} from './gh-pages.js'
import pMemoize from 'p-memoize'
import {ONE_HOUR_CACHE} from '../../ccc-lib/cache.js'

const _getBus = () => get(GH_PAGES('bus-times.json')).json()
export const getBus = pMemoize(_getBus, {
	cache: ONE_HOUR_CACHE,
})

export async function bus(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getBus()
}

const _getModes = () => get(GH_PAGES('transportation.json')).json()
export const getModes = pMemoize(_getModes, {
	cache: ONE_HOUR_CACHE,
})

export async function modes(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getModes()
}
