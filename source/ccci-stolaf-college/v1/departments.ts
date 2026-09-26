import {getJson} from '../../ccc-lib/http.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function departments(c: Context) {
	return c.json(
		await getJson('https://www.stolaf.edu/directory/departments', {
			searchParams: {format: 'json'},
		}),
	)
}
