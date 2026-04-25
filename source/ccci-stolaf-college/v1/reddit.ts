import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {fetchRedditPosts, fetchRedditComments} from '../../feeds/reddit.ts'
import type {Context} from '../../ccc-server/context.ts'

export async function posts(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const subreddit = ctx.params['subreddit']
	ctx.assert(subreddit, 400, ':subreddit param is required')
	ctx.body = await fetchRedditPosts(subreddit)
}

export async function comments(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	if (ctx.cached(ONE_HOUR)) return

	const url = ctx.URL.searchParams.get('url')
	ctx.assert(url, 400, '?url is required')
	ctx.body = await fetchRedditComments(url)
}
