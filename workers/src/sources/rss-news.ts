import {feedItemsFromRss} from '../../../source/feeds/rss-shape.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/// The feed the app reads for The Carletonian, the way the Node server's
/// `carletonian` route does.
export const CARLETONIAN_URL = 'https://thecarletonian.com/feed/'

/// Only RSS feeds we mean to read: the url comes from the caller, and this must
/// not become a way to make the worker fetch anything.
const RSS_HOSTS = new Set(['thecarletonian.com'])

export type RssNewsParams = {url: string}

/// An RSS feed, shaped into the feed items the apps are sent, the way
/// `fetchRssFeed` in source/feeds/rss.ts does for the Node server. Unlike it,
/// a feed that cannot be read is an error, not an empty list, so the last good
/// copy keeps being served rather than being replaced by nothing.
export const rssNews = defineSource({
	name: 'rss-news',
	key: ({url}: RssNewsParams) => url,
	async load({url}) {
		let parsed = new URL(url)
		if (parsed.protocol !== 'https:' || !RSS_HOSTS.has(parsed.hostname)) {
			throw new Error(`${url} is not an RSS feed this reads`)
		}
		// the host was checked above, so a redirect to another is not followed
		let response = await fetch(url, {redirect: 'manual'})
		if (!response.ok) {
			throw new Error(`The feed responded ${String(response.status)} for ${url}`)
		}
		let body = await response.text()
		// well-formed XML with no items reads as an empty feed, which a page standing
		// in for the feed (a bot challenge, an error page) can be; only RSS is a feed
		if (!/<rss[\s>]/.test(body)) {
			throw new Error(`${url} did not answer with an RSS feed`)
		}
		return feedItemsFromRss(body)
	},
	ttl: HOUR,
	staleIfError: DAY,
})
registerSource(rssNews)
