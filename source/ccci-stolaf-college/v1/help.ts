import {get} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(get, {maxAge: ONE_DAY})

let url = GH_PAGES('help.json')

export function getHelp() {
	return GET(url).json()
}

export async function help(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getHelp()
}
