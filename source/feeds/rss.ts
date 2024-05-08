import {get} from '../ccc-lib/http.js'
import {JSDOM} from 'jsdom'
import {FeedItemSchema, type FeedItemType} from './types.js'

export async function fetchRssFeed(
	url: string | URL,
	query = {},
): Promise<FeedItemType[]> {
	let body = await get(url, {searchParams: query}).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	return Array.from(dom.window.document.querySelectorAll('item')).map(
		convertRssItemToStory,
	)
}

function nodeListTextContent(nodeList: NodeListOf<Element>): string[] {
	return Array.from(nodeList).flatMap((el) =>
		el.textContent ? [el.textContent] : [],
	)
}

export function convertRssItemToStory(item: Element) {
	let authors = nodeListTextContent(item.querySelectorAll('dc\\:creator'))
	authors = authors.length ? authors : ['Unknown Author']

	let categories = nodeListTextContent(item.querySelectorAll('category'))

	let link = item.querySelector('link')?.textContent ?? null

	let title = item.querySelector('title')?.textContent ?? ''
	title = JSDOM.fragment(title).textContent?.trim() || '(no title)' // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing

	let datePublished = item.querySelector('pubDate')?.textContent ?? null

	let descriptionEl = item.querySelector('description')

	let content =
		item.getAttribute('content:encoded') ??
		descriptionEl?.textContent ??
		'(no content)'
	content = JSDOM.fragment(content).textContent?.trim() ?? ''

	let excerpt: string | null =
		descriptionEl?.textContent ?? content.substring(0, 250)
	excerpt = JSDOM.fragment(excerpt).textContent?.trim() ?? null

	let featuredImage = null
	if (item.querySelector('enclosure')) {
		let featuredMediaInfo = item.querySelector('enclosure')
		let containsImage = featuredMediaInfo
			?.getAttribute('type')
			?.startsWith('image/')

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
