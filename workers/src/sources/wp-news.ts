import {feedItemsFrom} from '../../../source/feeds/wp-json-shape.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {SOURCE_TTL} from '../lifetimes.ts'
import {upstream} from '../upstream.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/// The posts the app reads for St. Olaf news. St. Olaf's WordPress blocks the
/// Node server's IP, but not a Worker's, so this is served from here.
export const STOLAF_NEWS_URL = 'https://wp.stolaf.edu/wp-json/wp/v2/posts?per_page=10&_embed=true'

/// The posts the app reads for Carleton News, the way the Node server's
/// `carleton-now` route does.
export const CARLETON_NOW_URL =
	'https://www.carleton.edu/news/wp-json/wp/v2/posts?per_page=10&_embed=true'

/// The posts the app reads for The Olaf Messenger, the way the Node server's
/// `mess` route does.
export const MESSENGER_URL =
	'https://www.olafmessenger.com/wp-json/wp/v2/posts/?per_page=10&_embed=true'

/// The posts the app reads for The Carletonian, asked for as the Messenger's
/// are: the papers run the same WordPress plugins.
export const CARLETONIAN_URL =
	'https://thecarletonian.com/wp-json/wp/v2/posts/?per_page=10&_embed=true'

/// Only WordPress sites we mean to read: the url comes from the caller, and
/// this must not become a way to make the worker fetch anything.
const WORDPRESS_HOSTS = new Set([
	'wp.stolaf.edu',
	'www.carleton.edu',
	'www.olafmessenger.com',
	'thecarletonian.com',
])

export type WpNewsParams = {url: string}

/// A WordPress posts feed, shaped into the feed items the apps are sent, the
/// way `fetchWpJson` in source/feeds/wp-json.ts does for the Node server.
export const wpNews = defineSource({
	name: 'wp-news',
	key: ({url}: WpNewsParams) => url,
	async load({url}) {
		let parsed = new URL(url)
		if (parsed.protocol !== 'https:' || !WORDPRESS_HOSTS.has(parsed.hostname)) {
			throw new Error(`${url} is not a WordPress feed this reads`)
		}
		// the host was checked above, so a redirect to another is not followed
		let response = await upstream(url)
		if (!response.ok) {
			throw new Error(`WordPress responded ${String(response.status)} for ${url}`)
		}
		return feedItemsFrom(await response.json())
	},
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(wpNews)
