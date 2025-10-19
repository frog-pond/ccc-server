import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {fetchRssFeed} from '../../feeds/rss.ts'
import {fetchWpJson, deprecatedWpJson} from '../../feeds/wp-json.ts'
import type {Context} from '../../ccc-server/context.ts'

const cachedRssFeed = fetchRssFeed
const cachedWpJsonFeed = fetchWpJson

export async function rss(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let urlToFetch = ctx.URL.searchParams.get('url')
	ctx.assert(urlToFetch, 400, '?url is required')
	ctx.body = await cachedRssFeed(urlToFetch)
}

export async function wpJson(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	let urlToFetch = ctx.URL.searchParams.get('url')
	ctx.assert(urlToFetch, 400, '?url is required')
	ctx.body = await cachedWpJsonFeed(urlToFetch)
}

export async function stolaf(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedWpJsonFeed(new URL('https://wp.stolaf.edu/wp-json/wp/v2/posts'), {
		per_page: 10,
		_embed: true,
	})
}

export async function oleville(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedRssFeed(new URL('https://www.oleville.com/blog-feed.xml'))
}

export function politicole(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = deprecatedWpJson()
}

export async function mess(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedWpJsonFeed(
		new URL('https://www.theolafmessenger.com/wp-json/wp/v2/posts/'),
		{per_page: 10, _embed: true},
	)
}

export function ksto(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = deprecatedWpJson()
}

export async function krlx(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedRssFeed(new URL('https://content.krlx.org/feed/'))
}
