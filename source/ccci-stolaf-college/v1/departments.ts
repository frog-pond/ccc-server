import {get} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import mem from 'memoize'
import type {Context} from '../../ccc-server/context.ts'

const GET = mem(get, {maxAge: ONE_DAY})

export function getDepartments() {
	let url = 'https://www.stolaf.edu/directory/departments'
	return GET(url, {searchParams: {format: 'json'}}).json()
}

export async function departments(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getDepartments()
}
