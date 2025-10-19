import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

export function getMajors() {
	let url = 'https://www.stolaf.edu/directory/majors'
	return getJson(url, {searchParams: {format: 'json'}})
}

export async function majors(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	ctx.body = await getMajors()
}
