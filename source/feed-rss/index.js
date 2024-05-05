import {get} from '../../ccc-lib/http.js'
import _jsdom from 'jsdom'
const {JSDOM} = _jsdom

export async function fetchRssFeed(url, query = {}) {
	const body = await get(url, {query}).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})

	let storyEls = [...dom.window.document.querySelectorAll('item')]
	return storyEls.map(convertRssItemToStory)
}

export function convertRssItemToStory(item) {
	let authors = Array.from(item.querySelectorAll('dc\\:creator')).map(
		(el) => el.textContent,
	)
	authors = authors.length ? authors : ['Unknown Author']

	let categories = Array.from(item.querySelectorAll('category')).map(
		(el) => el.textContent,
	)

	let link = item.querySelector('link')
	link = link ? link.textContent : null

	let title = item.querySelector('title')
	title = title ? title.textContent : '(no title)'
	title = JSDOM.fragment(title).textContent.trim()

	let datePublished = item.querySelector('pubDate')
	datePublished = datePublished ? datePublished.textContent : null

	let descriptionEl = item.querySelector('description')

	let content = item.getAttribute('content:encoded')
	content = content || (descriptionEl && descriptionEl.textContent)
	content = content || '(no content)'
	content = JSDOM.fragment(content).textContent.trim()

	let excerpt = descriptionEl
		? descriptionEl.textContent
		: content.substr(0, 250)
	excerpt = JSDOM.fragment(excerpt).textContent.trim()

	let featuredImage = null
	if (item.querySelector('enclosure')) {
		let featuredMediaInfo = item.querySelector('enclosure')
		let containsImage = featuredMediaInfo
			.getAttribute('type')
			.startsWith('image/')

		if (featuredMediaInfo && containsImage) {
			featuredImage = featuredMediaInfo.getAttribute('url')
		}
	}

	return {
		authors,
		categories,
		content,
		datePublished,
		excerpt,
		featuredImage,
		link,
		title,
	}
}
