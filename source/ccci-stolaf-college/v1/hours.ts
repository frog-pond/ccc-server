import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES} from './gh-pages.ts'
import {hoursAt, hoursOn, isCalendarDate, secondsUntilMidnight} from '../../schedules/active.ts'
import {getScheduleSnapshot} from './schedule-data.ts'
import type {Context} from '../../ccc-server/context.ts'

/**
 * The hours as they stand today, so a break's schedule replaces the usual one
 * while it lasts. `?date=YYYY-MM-DD` asks for another campus date's hours
 * instead, for looking ahead or back.
 */
export async function buildingHours(ctx: Context) {
	let date = typeof ctx.query['date'] === 'string' ? ctx.query['date'] : undefined
	if (date !== undefined && !isCalendarDate(date)) ctx.throw(400, 'date must be YYYY-MM-DD')
	// Today's hours change at campus midnight; nothing keeps them past it.
	// A named date's hours do not depend on the day they are asked for.
	let responses = await getScheduleSnapshot(
		ctx,
		date !== undefined
			? undefined
			: (snapshot) => secondsUntilMidnight(Date.now(), snapshot.calendar.data.timezone) * 1000,
	)
	ctx.body = date !== undefined ? hoursOn(responses, date) : hoursAt(responses, Date.now())
}

export async function campusDirectory(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson(GH_PAGES('building-directory.json'))
}
