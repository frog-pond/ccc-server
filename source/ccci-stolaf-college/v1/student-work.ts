import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {boardIds, unitOf} from '../../student-work/oracle.ts'
import {postingUnits, type UnitCache} from '../../student-work/units.ts'
import type {Context} from '../../ccc-server/context.ts'

/// Outlives each response's one-hour cache, so a refresh reads only the
/// postings that went up since the last one.
const cache: UnitCache = new Map()

/// Each Student Work posting's unit, so the app can sort postings into areas
/// without searching Oracle once per unit.
export async function units(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await postingUnits({boardIds, unitOf}, cache)
}
