import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'

import {presence as _presence} from '../../student-orgs/presence.js'
import type {Context} from '../../ccc-server/context.js'

const CACHE_DURATION = ONE_HOUR * 36

export const presence = mem(_presence, {maxAge: CACHE_DURATION})

export async function orgs(ctx: Context) {
	ctx.cacheControl(CACHE_DURATION)

	ctx.body = await presence('stolaf')
}
