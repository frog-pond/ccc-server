import {get} from '../ccc-lib/http.js'
import {JSDOM} from 'jsdom'
import {FeedItemSchema, type FeedItemType} from './types.js'
import type {SearchParamsOption} from 'ky'
import {z} from 'zod'
import moment from 'moment'

type WpJsonFeedEntryType = z.infer<typeof WpJsonFeedEntrySchema>
const WpJsonFeedEntrySchema = z.object({
	_embedded: z.optional(
		z.object({
			author: z.array(z.object({id: z.unknown(), name: z.string().or(z.undefined())})).optional(),
			'wp:featuredmedia': z
				.array(
					z.object({
						id: z.unknown(),
						media_type: z.union([z.literal('image'), z.string()]),
						media_details: z.object({
							sizes: z.optional(z.record(z.object({source_url: z.string().url()}))),
						}),
						source_url: z.string().url(),
					}),
				)
				.nullable()
				.optional(),
			'wp:term': z.array(z.array(z.object({taxonomy: z.string(), name: z.string()}))),
		}),
	),
	/** this is "author ID," not "author name" */
	author: z.unknown(),
	featured_media: z.number().optional(),
	content: z.object({rendered: z.string()}),
	excerpt: z.object({rendered: z.string()}),
	title: z.object({rendered: z.string()}),
	date_gmt: z.string(),
	link: z.string().url(),
})

const WpJsonFeedResponseSchema = z.array(WpJsonFeedEntrySchema)

export async function fetchWpJson(
	url: string | URL,
	query: SearchParamsOption = {},
): Promise<FeedItemType[]> {
	const response = await get(url, {searchParams: query})	
	const feed = WpJsonFeedResponseSchema.parse(await response.clone().json())
	return feed.map(convertWpJsonItemToStory)
}

export function convertWpJsonItemToStory(item: WpJsonFeedEntryType) {
	let categories =
		item._embedded?.['wp:term'].flatMap((category) =>
			category.flatMap((c) => (c.taxonomy === 'category' ? [c.name] : [])),
		) ?? []

	let author = item._embedded?.author?.find((a) => a.id === item.author)?.name ?? 'Unknown Author'

	let featuredImage = null
	if (item._embedded?.['wp:featuredmedia']) {
		let featuredMediaInfo = item._embedded['wp:featuredmedia'].find(
			(m) => m.id === item.featured_media && m.media_type === 'image',
		)

		if (featuredMediaInfo) {
			featuredImage =
				featuredMediaInfo.media_details.sizes?.['medium_large']?.source_url ??
				featuredMediaInfo.source_url
		}
	}

	return FeedItemSchema.parse({
		authors: [author],
		categories: categories,
		content: item.content.rendered,
		datePublished: moment(
			item.date_gmt.endsWith('Z') || item.date_gmt.includes('+')
				? item.date_gmt
				: `${item.date_gmt}Z`,
		).toISOString(),
		excerpt: JSDOM.fragment(item.excerpt.rendered).textContent?.trim() ?? '',
		featuredImage: featuredImage,
		link: item.link,
		title: JSDOM.fragment(item.title.rendered).textContent?.trim() ?? '',
	})
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
