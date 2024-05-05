import {get} from '../../ccc-lib/http.js'
import {JSDOM} from 'jsdom'

export async function fetchWpJson(url, query = {}) {
	const feed = await get(url, {searchParams: query}).json()
	return feed.map(convertWpJsonItemToStory)
}

export function convertWpJsonItemToStory(item) {
	let categories = []
	if (item._embedded && item._embedded['wp:term']) {
		categories = item._embedded['wp:term'].flatMap((category) =>
			category.filter((c) => c.taxonomy === 'category').map((c) => c.name),
		)
	}

	let author = item.author
	if (item._embedded && item._embedded.author) {
		let authorInfo = item._embedded.author.find((a) => a.id === item.author)
		author = authorInfo ? authorInfo.name : 'Unknown Author'
	} else {
		author = 'Unknown Author'
	}

	let featuredImage = null
	if (item._embedded && item._embedded['wp:featuredmedia']) {
		let featuredMediaInfo = item._embedded['wp:featuredmedia'].find(
			(m) => m.id === item.featured_media && m.media_type === 'image',
		)

		if (featuredMediaInfo) {
			if (
				featuredMediaInfo.media_details.sizes &&
				featuredMediaInfo.media_details.sizes.medium_large
			) {
				featuredImage =
					featuredMediaInfo.media_details.sizes.medium_large.source_url
			} else {
				featuredImage = featuredMediaInfo.source_url
			}
		}
	}

	return {
		authors: [author],
		categories: categories,
		content: item.content.rendered,
		datePublished: item.date_gmt,
		excerpt: JSDOM.fragment(item.excerpt.rendered).textContent.trim(),
		featuredImage: featuredImage,
		link: item.link,
		title: JSDOM.fragment(item.title.rendered).textContent.trim(),
	}
}

export function deprecatedWpJson() {
	return [
		{
			content: '',
			excerpt: 'This news source is no longer being updated.',
			url: 'https://github.com/frog-pond/ccc-server/discussions/564',
			title: 'Deprecated endpoint',
		},
	]
}
