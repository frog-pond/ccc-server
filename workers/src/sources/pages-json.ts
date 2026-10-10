import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {SOURCE_TTL} from '../lifetimes.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/// Only the places the colleges publish their data files: the url comes from
/// this worker's own route table, and this must not become a way to make the
/// worker fetch anything.
const PAGES_HOSTS = new Set(['stolaf.dev', 'carls-app.github.io'])

export type PagesJsonParams = {url: string}

/// A JSON file published on GitHub Pages, passed through as it is, the way the
/// Node server's `getJson` routes do. A file that is not JSON is an error, so
/// the last good copy keeps being served rather than a page standing in for it.
export const pagesJson = defineSource({
	name: 'pages-json',
	key: ({url}: PagesJsonParams) => url,
	async load({url}) {
		let parsed = new URL(url)
		if (parsed.protocol !== 'https:' || !PAGES_HOSTS.has(parsed.hostname)) {
			throw new Error(`${url} is not a data file this reads`)
		}
		// the host was checked above, so a redirect to another is not followed
		let response = await fetch(url, {redirect: 'manual'})
		if (!response.ok) {
			throw new Error(`The data file responded ${String(response.status)} for ${url}`)
		}
		return (await response.json()) as unknown
	},
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(pagesJson)
