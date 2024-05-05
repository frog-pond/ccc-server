import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'

import {presence as _presence} from '../../calendar-presence/index.js'

const CACHE_DURATION = ONE_HOUR * 36

export const presence = mem(_presence, {maxAge: CACHE_DURATION})

export async function orgs(ctx) {
	ctx.cacheControl(CACHE_DURATION)

	ctx.body = await presence('stolaf')
}
