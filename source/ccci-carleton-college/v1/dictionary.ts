import {getJson} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {publicMaxAge} from '../../ccc-worker/cache.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function dictionary(c: Context) {
	c.header('Cache-Control', publicMaxAge(ONE_HOUR))
	return c.json(await getJson(GH_PAGES('dictionary-carls.json')))
}
