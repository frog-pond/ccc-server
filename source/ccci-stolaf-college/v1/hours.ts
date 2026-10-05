import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {resolveScheduleData} from '../../schedules/resolve.ts'
import {getScheduleData} from './schedule-data.ts'
import type {Context} from '../../ccc-server/context.ts'

export async function buildingHours(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let [hours, calendar] = await Promise.all([
		getScheduleData('building-hours-authored.json'),
		getScheduleData('breaks.json'),
	])
	ctx.body = resolveScheduleData(calendar, hours)
}

export async function campusDirectory(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson(GH_PAGES('building-directory.json'))
}
