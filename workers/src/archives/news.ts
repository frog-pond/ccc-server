import {feedItemsFrom} from '../../../source/feeds/wp-json-shape.ts'
import type {FeedItemType} from '../../../source/feeds/types.ts'
import {fromJson, registerArchive, toJson} from '../archive.ts'
import {upstream} from '../upstream.ts'

/// Posts a backfill step reads. Small, so one step stays one modest request.
const PER_PAGE = 20

/// Only the WordPress sites the news routes read: the address comes from this
/// worker's own route table.
const NEWS_HOSTS = new Set([
	'wp.stolaf.edu',
	'www.carleton.edu',
	'www.olafmessenger.com',
	'thecarletonian.com',
	'content.krlx.org',
])

export type NewsArchiveParams = {
	/// the site's WordPress posts endpoint, without a query
	posts: string
}

/// The WordPress posts endpoint behind a news feed's address.
export const postsEndpoint = (url: string) => {
	let parsed = new URL(url)
	return `${parsed.origin}${parsed.pathname.replace(/\/$/u, '')}`
}

/// A news feed's posts, as feed items, kept by link (or, without one, by title
/// and date). The history is read from the site's WordPress, newest first, a
/// page at a time, until WordPress has no more pages.
export const newsArchive = registerArchive({
	name: 'news',
	key: ({posts}: NewsArchiveParams) => posts,
	id: (item: FeedItemType) => item.link ?? `${item.title} ${item.datePublished ?? ''}`,
	at: (item: FeedItemType) => (item.datePublished ? Date.parse(item.datePublished) : 0),
	columns: {
		link: 'TEXT',
		title: 'TEXT NOT NULL',
		date_published: 'TEXT',
		excerpt: 'TEXT',
		content: 'TEXT NOT NULL',
		featured_image: 'TEXT',
		authors: 'TEXT NOT NULL',
		categories: 'TEXT NOT NULL',
	},
	toRow: (item: FeedItemType) => ({
		link: item.link,
		title: item.title,
		date_published: item.datePublished,
		excerpt: item.excerpt,
		content: item.content,
		featured_image: item.featuredImage,
		authors: toJson(item.authors),
		categories: toJson(item.categories),
	}),
	fromRow: (row): FeedItemType => ({
		authors: fromJson(row['authors']!) as string[],
		categories: fromJson(row['categories']!) as string[],
		content: row['content'] as string,
		datePublished: row['date_published'] as string | null,
		excerpt: row['excerpt'] as string | null,
		featuredImage: row['featured_image'] as string | null,
		link: row['link'] as string | null,
		title: row['title'] as string,
	}),
	async backfill({posts}, _env, cursor) {
		let endpoint = new URL(posts)
		if (endpoint.protocol !== 'https:' || !NEWS_HOSTS.has(endpoint.hostname)) {
			throw new Error(`${endpoint.origin}${endpoint.pathname} is not a news site this reads`)
		}
		let page = cursor === null ? 1 : Number(cursor)
		endpoint.search = new URLSearchParams({
			per_page: String(PER_PAGE),
			page: String(page),
			_embed: 'true',
		}).toString()
		// the host was checked above, so a redirect to another is not followed
		let response = await upstream(endpoint.href)
		let where = `${endpoint.origin}${endpoint.pathname}`
		if (response.status === 400) {
			// past the last page
			let body = (await response.json().catch(() => null)) as {code?: unknown} | null
			if (body?.code === 'rest_post_invalid_page_number') return {items: [], next: null}
		}
		if (!response.ok) {
			throw new Error(`WordPress responded ${String(response.status)} for ${where}`)
		}
		let items = feedItemsFrom(await response.json())
		let pages = Number(response.headers.get('x-wp-totalpages') ?? 'NaN')
		let more = items.length > 0 && (Number.isFinite(pages) ? page < pages : true)
		return {items, next: more ? String(page + 1) : null}
	},
})
