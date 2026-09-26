import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function faqs(c: Context) {
	return c.json(await getJson(GH_PAGES('faqs.json')))
}
