import {fetchRssFeed} from '../../feeds/rss.ts'
import {fetchWpJson, deprecatedWpJson} from '../../feeds/wp-json.ts'
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

export function nnb(c: Context) {
	return c.json(deprecatedWpJson())
}

export async function carletonNow(c: Context) {
	return c.json(
		await cachedWpJsonFeed(new URL('https://www.carleton.edu/news/wp-json/wp/v2/posts'), {
			per_page: 10,
			_embed: true,
		}),
	)
}

export async function carletonian(c: Context) {
	return c.json(await cachedRssFeed(new URL('https://thecarletonian.com/feed/')))
}

export async function krlxNews(c: Context) {
	return c.json(await cachedRssFeed(new URL('https://content.krlx.org/feed/')))
}

export function covidNews(c: Context) {
	return c.json(deprecatedWpJson())
}
