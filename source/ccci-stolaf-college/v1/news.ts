import {fetchRssFeed} from '../../feeds/rss.ts'
import {fetchWpJson, deprecatedWpJson} from '../../feeds/wp-json.ts'
import {deprecatedFeedItems} from './deprecated.ts'
import {requireQuery} from '../../ccc-worker/query.ts'
import type {Context} from '../../ccc-worker/env.ts'

const cachedRssFeed = fetchRssFeed
const cachedWpJsonFeed = fetchWpJson

export async function rss(c: Context) {
	let urlToFetch = requireQuery(c, 'url')
	return c.json(await cachedRssFeed(urlToFetch))
}

export async function wpJson(c: Context) {
	let urlToFetch = requireQuery(c, 'url')
	return c.json(await cachedWpJsonFeed(urlToFetch))
}

/// St. Olaf's WordPress blocks this server's IP. The app fetches it directly
/// now; this stub keeps already-shipped builds showing a notice rather than an
/// error screen.
export function stolaf(c: Context) {
	return c.json(deprecatedFeedItems("St. Olaf news can't be loaded right now. Tap for details."))
}

export function oleville(c: Context) {
	return c.json(deprecatedWpJson())
}

export function politicole(c: Context) {
	return c.json(deprecatedWpJson())
}

export async function mess(c: Context) {
	return c.json(
		await cachedWpJsonFeed(new URL('https://www.olafmessenger.com/wp-json/wp/v2/posts/'), {
			per_page: 10,
			_embed: true,
		}),
	)
}

export function ksto(c: Context) {
	return c.json(deprecatedWpJson())
}

export async function krlx(c: Context) {
	return c.json(await cachedRssFeed(new URL('https://content.krlx.org/feed/')))
}
