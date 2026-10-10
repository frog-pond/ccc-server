import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES} from './gh-pages.ts'
import {hoursAt, secondsUntilMidnight} from '../../schedules/active.ts'
import {getScheduleSnapshot} from './schedule-data.ts'
import type {Context} from '../../ccc-server/context.ts'

/** The hours as they stand today, so a break's schedule replaces the usual one while it lasts. */
export async function buildingHours(ctx: Context) {
	// Today's hours change at campus midnight; nothing keeps them past it.
	let responses = await getScheduleSnapshot(
		ctx,
		(snapshot) => secondsUntilMidnight(Date.now(), snapshot.calendar.data.timezone) * 1000,
	)
	ctx.body = hoursAt(responses, Date.now())
}

export async function campusDirectory(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson(GH_PAGES('building-directory.json'))
}
