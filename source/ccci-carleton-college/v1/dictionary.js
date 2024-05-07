import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {GH_PAGES} from './gh-pages.js'
import pMemoize from 'p-memoize'
import {ONE_HOUR_CACHE} from '../../ccc-lib/cache.js'

const _getDictionary = () => get(GH_PAGES('dictionary-carls.json')).json()
export const getDictionary = pMemoize(_getDictionary, {
	cache: ONE_HOUR_CACHE,
})

export async function dictionary(ctx) {
	ctx.cacheControl(ONE_HOUR)
	ctx.body = await getDictionary()
}
