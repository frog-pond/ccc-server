import {textFromHtml} from '../ccc-lib/dom.ts'
import {FeedItemSchema} from './types.ts'
import {z} from 'zod'
import moment from 'moment'

/// Turning WordPress REST posts into the feed items the apps are sent. Nothing
/// here fetches, so the Node server and the Cloudflare Worker share it.

export type WpJsonFeedEntryType = z.infer<typeof WpJsonFeedEntrySchema>
export const WpJsonFeedEntrySchema = z.object({
	_embedded: z.optional(
		z.object({
			/// Where a site has turned off its users endpoint, WordPress embeds an
			/// error (`{code, message, data}`) in place of each author. Such a
			/// post has an unknown author rather than failing the whole feed.
			author: z
				.array(z.object({id: z.unknown().optional(), name: z.string().optional()}))
				.optional(),
			/// Where WordPress cannot show a post's image -- the attachment was
			/// deleted, or is private -- it embeds an error (`{code, message,
			/// data}`) in its place, with none of the media fields. Such a post
			/// has no featured image rather than failing the whole feed.
			'wp:featuredmedia': z
				.array(
					z.object({
						id: z.unknown().optional(),
						media_type: z.union([z.literal('image'), z.string()]).optional(),
						media_details: z
							.object({
								sizes: z.optional(z.record(z.string(), z.object({source_url: z.url()}))),
							})
							.optional(),
						source_url: z.url().optional(),
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
	link: z.url(),
})

const WpJsonFeedResponseSchema = z.array(WpJsonFeedEntrySchema)

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
				featuredMediaInfo.media_details?.sizes?.['medium_large']?.source_url ??
				featuredMediaInfo.source_url ??
				null
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
		excerpt: textFromHtml(item.excerpt.rendered),
		featuredImage: featuredImage,
		link: item.link,
		title: textFromHtml(item.title.rendered),
	})
}

/// The feed items for a `wp/v2/posts` response; throws if it is not one.
export function feedItemsFrom(response: unknown) {
	return WpJsonFeedResponseSchema.parse(response).map(convertWpJsonItemToStory)
}
