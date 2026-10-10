import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {SOURCE_TTL} from '../lifetimes.ts'
import {upstream} from '../upstream.ts'

const DAY = 24 * 60 * 60 * 1000

/// Only St. Olaf's directory lists: the url comes from this worker's own
/// route table.
const DIRECTORY_URLS = new Set([
	'https://www.stolaf.edu/directory/departments?format=json',
	'https://www.stolaf.edu/directory/majors?format=json',
])

export type DirectoryParams = {url: string}

/// One of St. Olaf's directory lists, passed through as it is, the way the
/// Node server's `/directory/{departments,majors}` routes do. An answer that
/// is not JSON is an error, so the last good copy keeps being served.
export const stolafDirectory = defineSource({
	name: 'stolaf-directory',
	key: ({url}: DirectoryParams) => url,
	async load({url}) {
		let parsed = new URL(url)
		let where = `${parsed.origin}${parsed.pathname}`
		if (!DIRECTORY_URLS.has(url)) throw new Error(`${where} is not a directory list this reads`)
		// the url was checked above, so a redirect elsewhere is not followed
		let response = await upstream(url)
		if (!response.ok) {
			throw new Error(`The directory responded ${String(response.status)} for ${where}`)
		}
		return (await response.json()) as unknown
	},
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(stolafDirectory)
