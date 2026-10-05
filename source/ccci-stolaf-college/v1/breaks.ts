import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {parseScheduleData} from '../../schedules/parse.ts'
import {calendarResponse} from '../../schedules/resolve.ts'
import type {Context} from '../../ccc-server/context.ts'
import {getScheduleData} from './schedule-data.ts'

export async function breaks(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let {calendar} = parseScheduleData(await getScheduleData('breaks.json'), [])
	ctx.body = calendarResponse(calendar)
}
