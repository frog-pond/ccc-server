import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {GH_PAGES_FROM_REPO} from './gh-pages.ts'
import mem from 'memoize'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(getJson, {maxAge: ONE_HOUR})

let stavMealtimesUrl = GH_PAGES_FROM_REPO('stav-mealtimes', 'two-weeks.json')

export function getStavMealtimes() {
	return GET(stavMealtimesUrl)
}

export async function stavMealtimeReport(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getStavMealtimes()
}
