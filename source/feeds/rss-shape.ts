import {parseXml, textFromHtml} from '../ccc-lib/dom.ts'
import {FeedItemSchema} from './types.ts'
import moment from 'moment'

/// Turning an RSS feed into the feed items the apps are sent. Nothing here
/// fetches, reports to Sentry or reads metrics, so the Node server and the
/// Cloudflare Worker share it.

function nodeListTextContent(nodeList: Iterable<Element>): string[] {
	return Array.from(nodeList).flatMap((el) => {
		let text = el.textContent.trim()
		return text ? [text] : []
	})
}

/// Namespaced elements like `dc:creator` are looked up by their qualified
/// name: in an XML document a CSS selector only sees the local name.
export function convertRssItemToStory(item: Element) {
	let authors = nodeListTextContent(item.getElementsByTagName('dc:creator'))
	authors = authors.length ? authors : ['Unknown Author']

	let categories = nodeListTextContent(item.querySelectorAll('category'))

	let link = item.querySelector('link')?.textContent ?? null

	let title = item.querySelector('title')?.textContent ?? ''
	title = textFromHtml(title) || '(no title)'

	let datePublished = item.querySelector('pubDate')?.textContent ?? null
	if (datePublished) {
		datePublished = moment(datePublished).toISOString()
	}

	let descriptionEl = item.querySelector('description')

	let content =
		item.getElementsByTagName('content:encoded')[0]?.textContent ??
		descriptionEl?.textContent ??
		'(no content)'
	content = textFromHtml(content)

	let excerpt: string | null = descriptionEl?.textContent ?? content.substring(0, 250)
	excerpt = textFromHtml(excerpt) || null

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

/// The feed items for an RSS document; throws if it is not well-formed XML.
export function feedItemsFromRss(body: string) {
	const dom = parseXml(body)
	return Array.from(dom.querySelectorAll('item')).map(convertRssItemToStory)
}
