import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {fetchRssFeed} from '../../feeds/rss.js'
import {fetchWpJson, deprecatedWpJson} from '../../feeds/wp-json.js'
import {noonNewsBulletin} from './news/nnb.js'
import mem from 'memoize'
import type {Context} from '../../ccc-server/context.js'

const cachedRssFeed = mem(fetchRssFeed, {maxAge: ONE_HOUR})
const cachedWpJsonFeed = mem(fetchWpJson, {maxAge: ONE_HOUR})
const cachedNoonNewsBulletin = mem(noonNewsBulletin, {
	maxAge: ONE_HOUR * 6,
})

export async function rss(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	let urlToFetch = ctx.URL.searchParams.get('url')
	ctx.assert(urlToFetch, 400, '?url is required')
	ctx.body = await cachedRssFeed(urlToFetch)
}

export async function wpJson(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	let urlToFetch = ctx.URL.searchParams.get('url')
	ctx.assert(urlToFetch, 400, '?url is required')
	ctx.body = await cachedWpJsonFeed(urlToFetch)
}

export async function nnb(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)

	ctx.body = await cachedNoonNewsBulletin()
}

export async function carletonNow(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await cachedWpJsonFeed(new URL('https://www.carleton.edu/news/wp-json/wp/v2/posts'), {
		per_page: 10,
		_embed: true,
	})
}

export async function carletonian(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await cachedRssFeed(
		new URL('https://apps.carleton.edu/carletonian/feeds/blogs/tonian'),
	)
}

export async function krlxNews(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await cachedRssFeed(new URL('https://content.krlx.org/feed/'))
}

export function covidNews(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = deprecatedWpJson()
}
