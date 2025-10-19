import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {fetchRssFeed} from '../../feeds/rss.ts'
import {fetchWpJson, deprecatedWpJson} from '../../feeds/wp-json.ts'
import {noonNewsBulletin} from './news/nnb.ts'
import type {Context} from '../../ccc-server/context.ts'

const cachedRssFeed = fetchRssFeed
const cachedWpJsonFeed = fetchWpJson
const cachedNoonNewsBulletin = noonNewsBulletin

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

export async function nnb(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)
	if (ctx.cached(ONE_HOUR * 6)) return

	ctx.body = await cachedNoonNewsBulletin()
}

export async function carletonNow(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedWpJsonFeed(new URL('https://www.carleton.edu/news/wp-json/wp/v2/posts'), {
		per_page: 10,
		_embed: true,
	})
}

export async function carletonian(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedRssFeed(
		new URL('https://apps.carleton.edu/carletonian/feeds/blogs/tonian'),
	)
}

export async function krlxNews(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = await cachedRssFeed(new URL('https://content.krlx.org/feed/'))
}

export function covidNews(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	ctx.body = deprecatedWpJson()
}
