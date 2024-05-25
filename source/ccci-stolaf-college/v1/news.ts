import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'
import {FeedItemSchema} from '../../feeds/types.js'
import {fetchRssFeed} from '../../feeds/rss.js'
import {deprecatedWpJson, fetchWpJson} from '../../feeds/wp-json.js'

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

const KnownFeeds = z.enum(['stolaf', 'oleville', 'politicole', 'mess', 'ksto', 'krlx'])

export const getKnownFeedRoute = createRouteSpec({
	method: 'get',
	path: '/news/named/:feed',
	validate: {
		params: z.object({feed: KnownFeeds}),
		response: FeedItemSchema.array(),
	},
	handler: async (ctx) => {
		switch (ctx.request.params.feed) {
			case 'stolaf':
				ctx.body = await fetchWpJson(new URL('https://wp.stolaf.edu/wp-json/wp/v2/posts'), {
					per_page: 10,
					_embed: true,
				})
				break
			case 'krlx':
				ctx.body = await fetchRssFeed(new URL('https://content.krlx.org/feed/'))
				break
			case 'ksto':
				ctx.body = deprecatedWpJson()
				break
			case 'oleville':
				ctx.body = await fetchRssFeed(new URL('https://www.oleville.com/blog-feed.xml'))
				break
			case 'politicole':
				ctx.body = deprecatedWpJson()
				break
			case 'mess':
				ctx.body = await fetchWpJson(new URL('https://www.theolafmessenger.com/wp-json/wp/v2/posts/'), {
					per_page: 10,
					_embed: true,
				})
				break
		}
	},
})
