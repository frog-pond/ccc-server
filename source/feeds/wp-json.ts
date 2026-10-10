import {getJson} from '../ccc-lib/http.ts'
import {FeedItemSchema, type FeedItemType} from './types.ts'
import {feedItemsFrom} from './wp-json-shape.ts'
import type {SearchParamsOption} from 'ky'
import moment from 'moment'

export {
	WpJsonFeedEntrySchema,
	convertWpJsonItemToStory,
	type WpJsonFeedEntryType,
} from './wp-json-shape.ts'

export async function fetchWpJson(
	url: string | URL,
	query: SearchParamsOption = {},
): Promise<FeedItemType[]> {
	return feedItemsFrom(await getJson(url, {searchParams: query}))
}

export function deprecatedWpJson() {
	const item: FeedItemType = {
		authors: [],
		categories: [],
		datePublished: moment().toISOString(),
		content: '',
		excerpt: 'This news source is no longer being updated.',
		link: 'https://github.com/frog-pond/ccc-server/discussions/564',
		title: 'Deprecated endpoint',
		featuredImage: null,
	}
	return FeedItemSchema.array().parse([item])
}
