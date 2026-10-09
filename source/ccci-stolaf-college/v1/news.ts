import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {fetchRssFeed} from '../../feeds/rss.ts'
import {fetchWpJson, deprecatedWpJson} from '../../feeds/wp-json.ts'
import {deprecatedFeedItems} from './deprecated.ts'
import type {Context} from '../../ccc-server/context.ts'
import {examples} from '../../ccc-server/route-inputs.ts'

/// KRLX's news feed: the named route reads it, and it is the example a caller
/// of `news/rss` is offered.
export const KRLX_FEED_URL = 'https://content.krlx.org/feed/'
/// The Olaf Messenger's posts: the named route reads them, and they are the
/// example a caller of `news/wpjson` is offered.
export const MESS_POSTS_URL = 'https://www.olafmessenger.com/wp-json/wp/v2/posts/'

const cachedRssFeed = fetchRssFeed
const cachedWpJsonFeed = fetchWpJson

export async function rss(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let urlToFetch = ctx.URL.searchParams.get('url')
	ctx.assert(urlToFetch, 400, '?url is required')
	ctx.body = await cachedRssFeed(urlToFetch)
}
rss.inputs = {url: {...examples(KRLX_FEED_URL), required: true}}

export async function wpJson(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let urlToFetch = ctx.URL.searchParams.get('url')
	ctx.assert(urlToFetch, 400, '?url is required')
	ctx.body = await cachedWpJsonFeed(urlToFetch)
}
wpJson.inputs = {url: {...examples(MESS_POSTS_URL), required: true}}

/// St. Olaf's WordPress blocks this server's IP. The app fetches it directly
/// now; this stub keeps already-shipped builds showing a notice rather than an
/// error screen.
export function stolaf(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = deprecatedFeedItems("St. Olaf news can't be loaded right now. Tap for details.")
}

export function oleville(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = deprecatedWpJson()
}

export function politicole(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = deprecatedWpJson()
}

export async function mess(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedWpJsonFeed(new URL(MESS_POSTS_URL), {
		per_page: 10,
		_embed: true,
	})
}

export function ksto(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = deprecatedWpJson()
}

export async function krlx(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedRssFeed(new URL(KRLX_FEED_URL))
}
