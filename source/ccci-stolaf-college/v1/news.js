/* eslint-disable camelcase */

import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {fetchRssFeed} from '../../feed-rss/index.js'
import {fetchWpJson, deprecatedWpJson} from '../../feed-wpjson/index.js'
import mem from 'memoize'

export const cachedRssFeed = mem(fetchRssFeed, {maxAge: ONE_HOUR})
export const cachedWpJsonFeed = mem(fetchWpJson, {maxAge: ONE_HOUR})

export async function rss(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await cachedRssFeed(ctx.query.url)
}

export async function wpJson(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await cachedWpJsonFeed(ctx.query.url)
}

export async function stolaf(ctx) {
	ctx.cacheControl(ONE_HOUR)

	let url = 'https://wp.stolaf.edu/wp-json/wp/v2/posts'
	ctx.body = await cachedWpJsonFeed(url, {per_page: 10, _embed: true})
}

export async function oleville(ctx) {
	ctx.cacheControl(ONE_HOUR)

	let url = 'https://www.oleville.com/blog-feed.xml'
	ctx.body = await cachedRssFeed(url)
}

export function politicole(ctx) {
	ctx.body = deprecatedWpJson()
}

export async function mess(ctx) {
	ctx.cacheControl(ONE_HOUR)

	let url = 'https://www.theolafmessenger.com/wp-json/wp/v2/posts/'
	ctx.body = await cachedWpJsonFeed(url, {per_page: 10, _embed: true})
}

export function ksto(ctx) {
	ctx.body = deprecatedWpJson()
}

export async function krlx(ctx) {
	ctx.cacheControl(ONE_HOUR)

	let url = 'https://content.krlx.org/feed/'
	ctx.body = await cachedRssFeed(url)
}
