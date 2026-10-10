import * as Sentry from '@sentry/node'
import {getText} from '../ccc-lib/http.ts'
import {feedItemsFromRss} from './rss-shape.ts'
import type {FeedItemType} from './types.ts'
import {feedName, recordFeedFailure} from '../ccc-lib/feed-metrics.ts'

export {convertRssItemToStory} from './rss-shape.ts'

export async function fetchRssFeed(url: string | URL, query = {}): Promise<FeedItemType[]> {
	try {
		const body = await getText(url, {searchParams: query})
		return feedItemsFromRss(body)
	} catch (error) {
		console.error(`Failed to fetch RSS feed from ${String(url)}:`, error)
		Sentry.captureException(error, {tags: {url: String(url)}}) // TODO: figure out how these interact - but need to see data in sentry first
		Sentry.logger.error('Failed to fetch RSS feed', {url: String(url)})
		// answered with no stories, which the route's count can't tell from a quiet feed
		recordFeedFailure('rss', feedName(url))
		return []
	}
}
