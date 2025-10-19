import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {presence} from '../../student-orgs/presence.ts'
import type {Context} from '../../ccc-server/context.ts'

const CACHE_DURATION = ONE_HOUR * 36

export async function orgs(ctx: Context) {
	ctx.cacheControl(CACHE_DURATION)
	if (ctx.cached(CACHE_DURATION)) return

	ctx.body = await presence('stolaf')
}
