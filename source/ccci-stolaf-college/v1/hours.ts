import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const getBuildingHours = mem(
	async () => {
		const response = await getJson(GH_PAGES('building-hours.json'))
		return response
	},
	{maxAge: ONE_HOUR},
)

export async function buildingHours(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getBuildingHours()
}
