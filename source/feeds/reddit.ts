import * as Sentry from '@sentry/node'
import {decode} from 'html-entities'
import {JSDOM} from 'jsdom'
import {z} from 'zod'
import {getJson} from '../ccc-lib/http.ts'
import {getRedditToken} from '../ccc-lib/reddit-auth.ts'

// ── Types ──────────────────────────────────────────────────────────────────

export const CrosspostParentSchema = z.object({
	title: z.string(),
	subreddit: z.string(),
	author: z.string(),
	selftext: z.string(),
	permalink: z.string(),
})
export type CrosspostParentType = z.infer<typeof CrosspostParentSchema>

export const PollOptionSchema = z.object({
	text: z.string(),
	votes: z.number(),
})

export const PollDataSchema = z.object({
	options: z.array(PollOptionSchema),
	totalVotes: z.number(),
	votingEndAt: z.string().nullable(),
})
export type PollDataType = z.infer<typeof PollDataSchema>

export const RedditPostSchema = z.object({
	id: z.string(),
	title: z.string(),
	author: z.string(),
	publishedAt: z.string(),
	permalink: z.string(),
	contentHtml: z.string(),
	thumbnail: z.string().url().nullable(),
	// New fields — present when fetched from JSON API
	postType: z.enum(['text', 'image', 'gallery', 'link', 'crosspost', 'poll']).optional(),
	imageUrl: z.string().url().nullable().optional(),
	images: z.array(z.string().url()).optional(),
	linkUrl: z.string().url().nullable().optional(),
	linkDomain: z.string().nullable().optional(),
	crosspostParent: CrosspostParentSchema.nullable().optional(),
	pollData: PollDataSchema.nullable().optional(),
})
export type RedditPostType = z.infer<typeof RedditPostSchema>

export const RedditCommentSchema: z.ZodType<RedditCommentType, z.ZodTypeDef, unknown> = z.lazy(() =>
	z.object({
		id: z.string(),
		author: z.string(),
		contentHtml: z.string(),
		publishedAt: z.string(),
		// Reddit API can return null for score on new/contest-mode posts
		score: z
			.number()
			.nullable()
			.default(0)
			.transform((v) => v ?? 0),
		replies: z.array(RedditCommentSchema),
	}),
)
export interface RedditCommentType {
	id: string
	author: string
	contentHtml: string
	publishedAt: string
	score: number
	replies: RedditCommentType[]
}

// ── Atom helpers ───────────────────────────────────────────────────────────

const THR_NS = 'http://purl.org/syndication/thread/1.0'
const MEDIA_NS = 'http://search.yahoo.com/mrss/'

function parseAuthor(entry: Element): string {
	const raw = entry.querySelector('author > name')?.textContent ?? 'Unknown'
	return raw.replace(/^\/u\//u, '')
}

function parseContent(entry: Element): string {
	const raw = entry.querySelector('content')?.textContent ?? ''
	if (!raw) return ''
	// Reddit RSS wraps post body in a table; extract only the <div class="md">
	// inner HTML, dropping the "submitted by /u/... [link] [comments]" row.
	const innerDom = new JSDOM(raw)
	const md = innerDom.window.document.querySelector('div.md')
	return md ? md.innerHTML : ''
}

function parsePublished(entry: Element): string {
	return entry.querySelector('published')?.textContent ?? ''
}

function parseId(entry: Element): string {
	return entry.querySelector('id')?.textContent ?? ''
}

function parseThumbnail(entry: Element): string | null {
	const thumbnail = entry.getElementsByTagNameNS(MEDIA_NS, 'thumbnail')[0]
	const url = thumbnail?.getAttribute('url')
	if (!url) return null
	try {
		new URL(url)
		return url
	} catch {
		return null
	}
}

// ── Post parser ────────────────────────────────────────────────────────────

export function parseRedditPosts(xml: string): RedditPostType[] {
	const dom = new JSDOM(xml, {contentType: 'text/xml'})
	const doc = dom.window.document
	const entries = Array.from(doc.querySelectorAll('entry'))

	return entries.flatMap((entry) => {
		const id = parseId(entry)
		if (!id) return []

		const permalink =
			entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ??
			entry.querySelector('link')?.getAttribute('href') ??
			id

		const result = RedditPostSchema.safeParse({
			id,
			title: (entry.querySelector('title')?.textContent ?? '(no title)').trim(),
			author: parseAuthor(entry),
			publishedAt: parsePublished(entry),
			permalink,
			contentHtml: parseContent(entry),
			thumbnail: parseThumbnail(entry),
		})

		return result.success ? [result.data] : []
	})
}

// ── Comment tree builder ───────────────────────────────────────────────────

export interface FlatEntry {
	id: string
	author: string
	contentHtml: string
	publishedAt: string
	score: number
	parentId: string | null
}

function parseCommentEntries(doc: Document): FlatEntry[] {
	return Array.from(doc.querySelectorAll('entry')).map((entry) => {
		const inReplyTo = entry.getElementsByTagNameNS(THR_NS, 'in-reply-to')[0]
		const parentId = inReplyTo?.getAttribute('ref') ?? null
		return {
			id: parseId(entry),
			author: parseAuthor(entry),
			contentHtml: parseContent(entry),
			publishedAt: parsePublished(entry),
			score: 0, // RSS feed does not include vote counts
			parentId,
		}
	})
}

export function buildCommentTree(entries: FlatEntry[]): RedditCommentType[] {
	// First entry is the post itself — skip it, use its id to identify root comments
	const [post, ...commentEntries] = entries
	if (!post) return []
	const postId = post.id

	const nodeMap = new Map<string, RedditCommentType & {parentId: string | null}>()
	for (const e of commentEntries) {
		nodeMap.set(e.id, {
			id: e.id,
			author: e.author,
			contentHtml: e.contentHtml,
			publishedAt: e.publishedAt,
			score: e.score,
			parentId: e.parentId,
			replies: [],
		})
	}

	const roots: RedditCommentType[] = []
	for (const [, node] of nodeMap) {
		if (node.parentId === postId || node.parentId === null) {
			roots.push(node)
		} else {
			const parent = nodeMap.get(node.parentId)
			if (parent) {
				parent.replies.push(node)
			} else {
				roots.push(node) // orphan → treat as top-level
			}
		}
	}
	return roots
}

export function parseRedditComments(xml: string): RedditCommentType[] {
	const dom = new JSDOM(xml, {contentType: 'text/xml'})
	const entries = parseCommentEntries(dom.window.document)
	return buildCommentTree(entries)
}

// ── JSON API parser ────────────────────────────────────────────────────────

interface RedditJsonChild {
	kind: string
	data: unknown
}

// Raw Reddit JSON API shapes — used only internally for posts
interface RawRedditPost {
	id: string
	title: string
	author: string
	created_utc: number
	permalink: string
	selftext_html: string | null
	thumbnail: string | null
	post_hint?: string
	is_gallery?: boolean
	is_self: boolean
	crosspost_parent?: string
	crosspost_parent_list?: Array<{
		id: string
		title: string
		author: string
		subreddit: string
		selftext: string
		permalink: string
		created_utc: number
		is_self: boolean
		is_gallery?: boolean
		thumbnail: string | null
	}>
	media_metadata?: Record<
		string,
		{
			status: string
			e: string
			s?: {u?: string; x?: number; y?: number}
		}
	>
	url_overridden_by_dest?: string
	domain?: string
	poll_data?: {
		options: Array<{text: string; total_vote_count?: number}>
		total_vote_count: number
		voting_end_timestamp?: number
	}
}

interface RawRedditListing {
	data: {
		children: Array<{kind: string; data: RawRedditPost}>
	}
}

const REDDIT_SPECIAL_THUMBNAILS = new Set(['self', 'default', 'nsfw', 'spoiler', 'image', ''])

function normalizeThumbnail(raw: string | null | undefined): string | null {
	if (!raw || REDDIT_SPECIAL_THUMBNAILS.has(raw)) return null
	try {
		new URL(raw)
		return raw
	} catch {
		return null
	}
}

function detectPostType(
	d: RawRedditPost,
): 'text' | 'image' | 'gallery' | 'link' | 'crosspost' | 'poll' {
	if (d.poll_data) return 'poll'
	if (d.crosspost_parent) return 'crosspost'
	if (d.is_gallery) return 'gallery'
	if (d.post_hint === 'image') return 'image'
	if (d.post_hint === 'link') return 'link'
	return 'text'
}

function extractGalleryImages(metadata: RawRedditPost['media_metadata']): string[] {
	if (!metadata) return []
	return Object.values(metadata)
		.filter((item) => item.status === 'valid' && item.e === 'Image' && item.s?.u)
		.map((item) => decode(item.s!.u!))
		.filter((url): url is string => Boolean(url))
}

export function parseRedditPostsJson(response: unknown): RedditPostType[] {
	const listing = response as RawRedditListing
	const children = listing?.data?.children ?? []

	return children.flatMap(({kind, data: d}) => {
		if (kind !== 't3') return []

		const postType = detectPostType(d)
		const thumbnail = normalizeThumbnail(d.thumbnail)

		// Crosspost parent metadata
		const rawCrosspost = d.crosspost_parent_list?.[0]
		const crosspostParent =
			rawCrosspost && postType === 'crosspost'
				? {
						title: rawCrosspost.title,
						subreddit: rawCrosspost.subreddit ?? '',
						author: rawCrosspost.author,
						selftext: rawCrosspost.selftext ?? '',
						permalink: `https://www.reddit.com${rawCrosspost.permalink}`,
					}
				: null

		// Gallery images (HTML-decode &amp; in preview URLs)
		const images = postType === 'gallery' ? extractGalleryImages(d.media_metadata) : []

		// Link and image URLs
		const externalUrl = d.url_overridden_by_dest ?? null
		const imageUrl = postType === 'image' ? externalUrl : null
		const linkUrl = postType === 'link' ? externalUrl : null
		const linkDomain =
			postType === 'link' && d.domain && !d.domain.startsWith('self.') ? d.domain : null

		// Poll data
		const pollData = d.poll_data
			? {
					options: d.poll_data.options.map((opt) => ({
						text: opt.text,
						votes: opt.total_vote_count ?? 0,
					})),
					totalVotes: d.poll_data.total_vote_count,
					votingEndAt: d.poll_data.voting_end_timestamp
						? new Date(d.poll_data.voting_end_timestamp * 1000).toISOString()
						: null,
				}
			: null

		const result = RedditPostSchema.safeParse({
			id: `t3_${d.id}`,
			title: d.title.trim(),
			author: d.author,
			publishedAt: new Date(d.created_utc * 1000).toISOString(),
			permalink: `https://www.reddit.com${d.permalink}`,
			contentHtml: d.selftext_html ?? '',
			thumbnail,
			postType,
			imageUrl,
			images: images.length > 0 ? images : undefined,
			linkUrl,
			linkDomain,
			crosspostParent,
			pollData,
		})

		return result.success ? [result.data] : []
	})
}

function parseCommentJsonChild(child: RedditJsonChild): RedditCommentType[] {
	if (child.kind !== 't1') return []

	const d = child.data as {
		id: string
		author: string
		body_html: string
		created_utc: number
		score: number | null
		replies: '' | {kind: string; data: {children: RedditJsonChild[]}}
	}

	const repliesChildren = d.replies && typeof d.replies === 'object' ? d.replies.data.children : []

	return [
		{
			id: `t1_${d.id}`,
			author: d.author,
			contentHtml: d.body_html,
			publishedAt: new Date(d.created_utc * 1000).toISOString(),
			score: d.score ?? 0,
			replies: repliesChildren.flatMap(parseCommentJsonChild),
		},
	]
}

export function parseRedditCommentsJson(response: unknown): RedditCommentType[] {
	if (!Array.isArray(response) || response.length < 2) return []
	const commentListing = response[1] as {
		data: {children: RedditJsonChild[]}
	}
	const children = commentListing.data.children
	return children.flatMap(parseCommentJsonChild)
}

// ── Fetch helpers ──────────────────────────────────────────────────────────

export async function fetchRedditPosts(subreddit: string): Promise<RedditPostType[]> {
	try {
		const token = await getRedditToken()

		let jsonUrl: string
		let headers: Record<string, string> = {}

		if (token) {
			jsonUrl = `https://oauth.reddit.com/r/${subreddit}/new.json?limit=25&raw_json=1`
			headers = {Authorization: `Bearer ${token}`}
		} else {
			jsonUrl = `https://www.reddit.com/r/${subreddit}/new.json?limit=25&raw_json=1`
		}

		const body = await getJson(jsonUrl, {headers})
		return parseRedditPostsJson(body)
	} catch (error) {
		Sentry.captureException(error, {tags: {subreddit}})
		return []
	}
}

export async function fetchRedditComments(postUrl: string): Promise<RedditCommentType[]> {
	try {
		const token = await getRedditToken()
		const parsed = new URL(postUrl)
		const jsonPath = parsed.pathname.replace(/\/$/, '') + '.json'

		let jsonUrl: string
		let headers: Record<string, string> = {}

		if (token) {
			jsonUrl = `https://oauth.reddit.com${jsonPath}?raw_json=1`
			headers = {Authorization: `Bearer ${token}`}
		} else {
			jsonUrl = `https://www.reddit.com${jsonPath}?raw_json=1`
		}

		const body = await getJson(jsonUrl, {headers})
		return parseRedditCommentsJson(body)
	} catch (error) {
		Sentry.captureException(error, {tags: {postUrl}})
		return []
	}
}
