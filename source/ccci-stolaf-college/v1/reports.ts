import {get} from '../../ccc-lib/http.js'
import {GH_PAGES_FROM_REPO} from './gh-pages.js'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'

const MealTimeSchema = z.array(
	z.object({
		date: z.string().date(),
		times: z.record(z.string().time(), z.number()),
	}),
)

export async function getStavMealtimes() {
	return MealTimeSchema.parse(await get(GH_PAGES_FROM_REPO('stav-mealtimes', 'two-weeks.json')).json())
}

export const getStavMealtimeReportRoute = createRouteSpec({
	method: 'get',
	path: '/reports/stav',
	validate: {
		response: MealTimeSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getStavMealtimes()
	},
})
