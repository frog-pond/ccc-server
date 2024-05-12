import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'

const GET = mem(get, {maxAge: ONE_DAY})

let url = GH_PAGES('color-printers.json')

export function getColorPrinters() {
	return GET(url).json()
}

export async function colorPrinters(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getColorPrinters()
}
