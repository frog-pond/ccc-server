import {get} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(get, {maxAge: ONE_HOUR})

let url = GH_PAGES('help.json')

export function getHelp() {
	return GET(url).json()
}

export async function help(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getHelp()
}
