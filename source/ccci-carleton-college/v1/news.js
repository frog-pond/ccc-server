import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {fetchRssFeed} from '../../feeds/rss.ts'
import {fetchWpJson, deprecatedWpJson} from '../../feeds/wp-json.ts'
import {noonNewsBulletin} from './news/nnb.js'
import mem from 'memoize'

export const cachedRssFeed = mem(fetchRssFeed, {maxAge: ONE_HOUR})
export const cachedWpJsonFeed = mem(fetchWpJson, {maxAge: ONE_HOUR})
export const cachedNoonNewsBulletin = mem(noonNewsBulletin, {
	maxAge: ONE_HOUR * 6,
})

export async function nnb(ctx) {
	ctx.cacheControl(ONE_HOUR * 6)

	ctx.body = await cachedNoonNewsBulletin()
}

export async function rss(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await cachedRssFeed(ctx.query.url)
}

export async function wpJson(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await cachedWpJsonFeed(ctx.query.url)
}

export async function carletonNow(ctx) {
	ctx.cacheControl(ONE_HOUR)

	let url = 'https://www.carleton.edu/news/wp-json/wp/v2/posts'
	ctx.body = await cachedWpJsonFeed(url, {per_page: 10, _embed: true})
}
export async function carletonian(ctx) {
	ctx.cacheControl(ONE_HOUR)

	let url = 'https://apps.carleton.edu/carletonian/feeds/blogs/tonian'
	ctx.body = await cachedRssFeed(url)
}
export async function krlxNews(ctx) {
	ctx.cacheControl(ONE_HOUR)

	let url = 'https://content.krlx.org/feed/'
	ctx.body = await cachedRssFeed(url)
}

export function covidNews(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = deprecatedWpJson()
}
