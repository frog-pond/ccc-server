import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES} from './gh-pages.ts'
import {hoursAt, secondsUntilMidnight} from '../../schedules/active.ts'
import {getScheduleSnapshot} from './schedule-data.ts'
import type {Context} from '../../ccc-server/context.ts'

/**
 * The hours as they stand today, so a break's schedule replaces the usual one
 * while it lasts. `?breaks=none` leaves every space's usual schedule in place,
 * for a client that picks the break itself (the app's dev-mode clock).
 */
export async function buildingHours(ctx: Context) {
	let breaks = ctx.query['breaks']
	if (breaks !== undefined && breaks !== 'none') ctx.throw(400, 'breaks must be none')
	// Today's hours change at campus midnight; nothing keeps them past it.
	// The usual schedules do not depend on the day they are asked for.
	let responses = await getScheduleSnapshot(
		ctx,
		breaks === 'none'
			? undefined
			: (snapshot) => secondsUntilMidnight(Date.now(), snapshot.calendar.data.timezone) * 1000,
	)
	ctx.body = breaks === 'none' ? responses.hours : hoursAt(responses, Date.now())
}

export async function campusDirectory(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await getJson(GH_PAGES('building-directory.json'))
}
