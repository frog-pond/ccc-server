import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-worker/env.ts'

export function getContacts() {
	return getJson(GH_PAGES('contact-info.json'))
}

export async function contacts(c: Context) {
	return c.json(await getContacts())
}
