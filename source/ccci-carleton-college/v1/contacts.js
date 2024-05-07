import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {GH_PAGES} from './gh-pages.js'
import pMemoize from 'p-memoize'
import {ONE_HOUR_CACHE} from '../../ccc-lib/cache.js'

const _getContacts = () => get(GH_PAGES('contact-info.json')).json()
export const getContacts = pMemoize(_getContacts, {cache: ONE_HOUR_CACHE})

export async function contacts(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getContacts()
}
