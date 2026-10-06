import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {getJson} from '../../ccc-lib/http.ts'
import {groupUnits, listedUnitsOf} from '../../student-work/areas.ts'
import {GH_PAGES} from './gh-pages.ts'
import {boardIds, unitOf} from '../../student-work/oracle.ts'
import {mostlyNull, postingUnits, type UnitCache} from '../../student-work/units.ts'
import type {Context} from '../../ccc-server/context.ts'

/// Outlives each response's one-hour cache, so a refresh reads only postings
/// that went up since the last one, and those still without a unit.
const cache: UnitCache = new Map()

/// The units the Student Work areas list, from the file the app publishes.
/// Undefined when it cannot be read, so a failed fetch costs only the
/// grouping, not the whole answer.
async function listedUnits(): Promise<Set<string> | undefined> {
	try {
		return listedUnitsOf(await getJson(GH_PAGES('student-work-areas.json')))
	} catch (error) {
		console.warn('student-work/units: could not read the areas file', error)
		return undefined
	}
}

/// Each Student Work posting's unit, so the app can sort postings into areas
/// without searching Oracle once per unit. A posting whose unit no area lists,
/// or that has none, reads "other", which the areas file gives a catch-all area.
export async function units(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let [units, listed] = await Promise.all([postingUnits({boardIds, unitOf}, cache), listedUnits()])
	if (mostlyNull(units)) {
		// Every Student Work area would read empty, with nothing else to say so.
		console.warn('student-work/units: most postings have no unit; has the template changed?')
	}
	ctx.body = groupUnits(units, listed)
}
