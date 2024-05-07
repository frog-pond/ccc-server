import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {GH_PAGES} from './gh-pages.js'
import pMemoize from 'p-memoize'
import {ONE_HOUR_CACHE} from '../../ccc-lib/cache.js'

const _getBuildingHours = () => get(GH_PAGES('building-hours.json')).json()
export const getBuildingHours = pMemoize(_getBuildingHours, {
	cache: ONE_HOUR_CACHE,
})

export async function buildingHours(ctx) {
	ctx.cacheControl(ONE_HOUR)
	ctx.body = await getBuildingHours()
}
