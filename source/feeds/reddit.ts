import * as Sentry from '@sentry/node'
import {JSDOM} from 'jsdom'
import {z} from 'zod'
import {getText} from '../ccc-lib/http.ts'

// ── Types ──────────────────────────────────────────────────────────────────

export const RedditPostSchema = z.object({
	id: z.string(),
	title: z.string(),
	author: z.string(),
	publishedAt: z.string(),
	permalink: z.string(),
	contentHtml: z.string(),
	thumbnail: z.string().url().nullable(),
})
export type RedditPostType = z.infer<typeof RedditPostSchema>

export const RedditCommentSchema: z.ZodType<RedditCommentType> = z.lazy(() =>
	z.object({
		id: z.string(),
		author: z.string(),
		contentHtml: z.string(),
		publishedAt: z.string(),
		replies: z.array(RedditCommentSchema),
	}),
)
export type RedditCommentType = {
	id: string
	author: string
	contentHtml: string
	publishedAt: string
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
	return entry.querySelector('content')?.textContent ?? ''
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
			title: entry.querySelector('title')?.textContent?.trim() ?? '(no title)',
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

export type FlatEntry = {
	id: string
	author: string
	contentHtml: string
	publishedAt: string
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
			parentId,
		}
	})
}

export function buildCommentTree(entries: FlatEntry[]): RedditCommentType[] {
	if (entries.length === 0) return []

	// First entry is the post itself — skip it, use its id to identify root comments
	const postId = entries[0]!.id
	const commentEntries = entries.slice(1)

	const nodeMap = new Map<string, RedditCommentType & {parentId: string | null}>()
	for (const e of commentEntries) {
		nodeMap.set(e.id, {
			id: e.id,
			author: e.author,
			contentHtml: e.contentHtml,
			publishedAt: e.publishedAt,
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

// ── Fetch helpers ──────────────────────────────────────────────────────────

export async function fetchRedditPosts(subreddit: string): Promise<RedditPostType[]> {
	try {
		const body = await getText(`https://www.reddit.com/r/${subreddit}.rss`)
		return parseRedditPosts(body)
	} catch (error) {
		Sentry.captureException(error, {tags: {subreddit}})
		return []
	}
}

export async function fetchRedditComments(postUrl: string): Promise<RedditCommentType[]> {
	try {
		const url = postUrl.endsWith('/') ? `${postUrl}.rss` : `${postUrl}/.rss`
		const body = await getText(url)
		return parseRedditComments(body)
	} catch (error) {
		Sentry.captureException(error, {tags: {postUrl}})
		return []
	}
}
