import {getJson} from '../ccc-lib/http.ts'
import type {FeedItemType} from './types.ts'
import {feedItemsFrom} from './wp-json-shape.ts'
import type {SearchParamsOption} from 'ky'

export {deprecatedWpJson} from './deprecated.ts'
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
