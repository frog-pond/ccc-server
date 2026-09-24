import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function bus(c: Context) {
	return c.json(await getJson(GH_PAGES('bus-times.json')))
}

export async function modes(c: Context) {
	return c.json(await getJson(GH_PAGES('transportation.json')))
}
