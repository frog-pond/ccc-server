import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import mem from 'memoize'

const GET = mem(get, {maxAge: ONE_DAY})

export function getDepartments() {
	let url = 'https://www.stolaf.edu/directory/departments'
	return GET(url, {searchParams: {format: 'json'}}).json()
}

export async function departments(ctx) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getDepartments()
}
