import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES_FROM_REPO} from './gh-pages.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function stavMealtimeReport(c: Context) {
	return c.json(await getJson(GH_PAGES_FROM_REPO('stav-mealtimes', 'two-weeks.json')))
}
