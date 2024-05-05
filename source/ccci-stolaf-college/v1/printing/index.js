import {get, ONE_DAY} from '../../../ccc-lib/index.js'
import mem from 'memoize'
import {GH_PAGES} from '../gh-pages.js'

const GET = mem(get, {maxAge: ONE_DAY})

let url = GH_PAGES('color-printers.json')

export function getColorPrinters() {
	return GET(url).json()
}

export async function colorPrinters(ctx) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getColorPrinters()
}
