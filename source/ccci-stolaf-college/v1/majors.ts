import {getJson} from '../../ccc-lib/http.ts'
import type {Context} from '../../ccc-worker/env.ts'

export function getMajors() {
	let url = 'https://www.stolaf.edu/directory/majors'
	return getJson(url, {searchParams: {format: 'json'}})
}

export async function majors(c: Context) {
	return c.json(await getMajors())
}
