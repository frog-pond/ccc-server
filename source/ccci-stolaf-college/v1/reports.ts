import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {GH_PAGES_FROM_REPO} from './gh-pages.js'
import mem from 'memoize'
import type {Context} from '../../ccc-server/context.js'

const GET = mem(get, {maxAge: ONE_HOUR})

let stavMealtimesUrl = GH_PAGES_FROM_REPO('stav-mealtimes', 'two-weeks.json')

export function getStavMealtimes() {
	return GET(stavMealtimesUrl).json()
}

export async function stavMealtimeReport(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getStavMealtimes()
}
