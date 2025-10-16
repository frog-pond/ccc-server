import * as Sentry from '@sentry/node'
import {get} from '../ccc-lib/http.ts'
import {JSDOM} from 'jsdom'
import {FeedItemSchema, type FeedItemType} from './types.ts'
import moment from 'moment'

export async function fetchRssFeed(url: string | URL, query = {}): Promise<FeedItemType[]> {
	try {
		const response = await get(url, {searchParams: query})
		const body = await response.text()
		const dom = new JSDOM(body, {contentType: 'text/xml'})
		return Array.from(dom.window.document.querySelectorAll('item')).map(convertRssItemToStory)
	} catch (error) {
		console.error(`Failed to fetch RSS feed from ${String(url)}:`, error)
		Sentry.captureException(error, {tags: {url: String(url)}}) // TODO: figure out how these interact - but need to see data in sentry first
		Sentry.logger.error('Failed to fetch RSS feed', {url: String(url)})
		return []
	}
}

function nodeListTextContent(nodeList: NodeListOf<Element>): string[] {
	return Array.from(nodeList).flatMap((el) => (el.textContent ? [el.textContent] : []))
}

export function convertRssItemToStory(item: Element) {
	let authors = nodeListTextContent(item.querySelectorAll('dc\\:creator'))
	authors = authors.length ? authors : ['Unknown Author']

	let categories = nodeListTextContent(item.querySelectorAll('category'))

	let link = item.querySelector('link')?.textContent ?? null

	let title = item.querySelector('title')?.textContent ?? ''
	title = JSDOM.fragment(title).textContent.trim() || '(no title)'

	let datePublished = item.querySelector('pubDate')?.textContent ?? null
	if (datePublished) {
		datePublished = moment(datePublished).toISOString()
	}

	let descriptionEl = item.querySelector('description')

	let content = item.getAttribute('content:encoded') ?? descriptionEl?.textContent ?? '(no content)'
	content = JSDOM.fragment(content).textContent.trim()

	let excerpt: string | null = descriptionEl?.textContent ?? content.substring(0, 250)
	excerpt = JSDOM.fragment(excerpt).textContent.trim() || null

	let featuredImage = null
	if (item.querySelector('enclosure')) {
		let featuredMediaInfo = item.querySelector('enclosure')
		let containsImage = featuredMediaInfo?.getAttribute('type')?.startsWith('image/')

		if (featuredMediaInfo && containsImage) {
			featuredImage = featuredMediaInfo.getAttribute('url')
		}
	}

	return FeedItemSchema.parse({
		authors,
		categories,
		content,
		datePublished,
		excerpt,
		featuredImage,
		link,
		title,
	})
}
