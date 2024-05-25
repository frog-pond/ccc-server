import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'
import {FeedItemSchema} from '../../feeds/types.js'
import {fetchRssFeed} from '../../feeds/rss.js'
import {deprecatedWpJson, fetchWpJson} from '../../feeds/wp-json.js'
import {NnbResponseSchema, noonNewsBulletin} from './news/nnb.js'

export const getRssFeedRoute = createRouteSpec({
	method: 'get',
	path: '/news/rss',
	validate: {
		query: z.object({url: z.string().url()}),
		response: FeedItemSchema.array(),
	},
	handler: async (ctx) => {
		ctx.body = await fetchRssFeed(ctx.request.query.url)
	},
})

export const getWpJsonFeedRoute = createRouteSpec({
	method: 'get',
	path: '/news/wpjson',
	validate: {
		query: z.object({url: z.string().url()}),
		response: FeedItemSchema.array(),
	},
	handler: async (ctx) => {
		ctx.body = await fetchWpJson(ctx.request.query.url)
	},
})

export const getNoonNewsBulletinRoute = createRouteSpec({
	method: 'get',
	path: '/news/named/nnb',
	validate: {
		response: NnbResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await noonNewsBulletin()
	},
})

const KnownFeeds = z.enum(['carleton-now', 'carletonian', 'krlx', 'covid'])

export const getKnownFeedRoute = createRouteSpec({
	method: 'get',
	path: '/news/named/:feed',
	validate: {
		params: z.object({feed: KnownFeeds}),
		response: FeedItemSchema.array(),
	},
	handler: async (ctx) => {
		switch (ctx.request.params.feed) {
			case 'carletonian':
				ctx.body = await fetchRssFeed(new URL('https://apps.carleton.edu/carletonian/feeds/blogs/tonian'))
				break
			case 'krlx':
				ctx.body = await fetchRssFeed(new URL('https://content.krlx.org/feed/'))
				break
			case 'carleton-now':
				ctx.body = await fetchWpJson(new URL('https://www.carleton.edu/news/wp-json/wp/v2/posts'), {
					per_page: 10,
					_embed: true,
				})
				break
			case 'covid':
				ctx.body = deprecatedWpJson()
				break
		}
	},
})
