import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {boardIds, unitOf} from '../../student-work/oracle.ts'
import {mostlyNull, postingUnits, type UnitCache} from '../../student-work/units.ts'
import type {Context} from '../../ccc-server/context.ts'

/// Outlives each response's one-hour cache, so a refresh reads only postings
/// that went up since the last one, and those still without a unit.
const cache: UnitCache = new Map()

/// Each Student Work posting's unit, so the app can sort postings into areas
/// without searching Oracle once per unit.
export async function units(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let units = await postingUnits({boardIds, unitOf}, cache)
	if (mostlyNull(units)) {
		// Every Student Work area would read empty, with nothing else to say so.
		console.warn('student-work/units: most postings have no unit; has the template changed?')
	}
	ctx.body = units
}
