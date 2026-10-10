import {DISCUSSION_URL, RETIRED_TITLE} from '../ccc-lib/deprecated.ts'
import {FeedItemSchema} from './types.ts'

/// Notices in place of news feeds that are no longer published, shaped as
/// feed items so the renderers older builds already ship can show them.
/// Nothing here fetches, so the Node server and the Cloudflare Worker share it.

export function deprecatedWpJson(now = new Date()) {
	return FeedItemSchema.array().parse([
		{
			authors: [],
			categories: [],
			datePublished: now.toISOString(),
			content: '',
			excerpt: 'This news source is no longer being updated.',
			link: DISCUSSION_URL,
			title: 'Deprecated endpoint',
			featuredImage: null,
		},
	])
}

/// The Noon News Bulletin was published from apps.carleton.edu and is not
/// coming back, so this says so rather than promising a return.
export function retiredNnb(now = new Date()) {
	return FeedItemSchema.array().parse([
		{
			authors: [],
			categories: [],
			datePublished: now.toISOString(),
			content: '',
			excerpt:
				'The Noon News Bulletin is no longer published. For campus announcements, see Carleton Now.',
			link: DISCUSSION_URL,
			title: RETIRED_TITLE,
			featuredImage: null,
		},
	])
}
