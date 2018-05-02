import got from 'got'
import mem from 'mem'
import _jsdom from 'jsdom'
import lodash from 'lodash'
import querystring from 'querystring'
const {groupBy, toPairs} = lodash
const {JSDOM} = _jsdom

const GET_BASE = (url, opts) =>
	got.get(
		url,
		Object.assign(
			{
				headers: {
					'User-Agent':
						'ccc-server/1 (https://github.com/frog-pond/ccc-server)',
				},
			},
			opts,
		),
	)

const ONE_HOUR = 60 * 60 * 1000
const GET_6_HOUR = mem(GET_BASE, {maxAge: ONE_HOUR * 6})

export async function fetchRssFeed(url, query = {}) {
	const resp = await GET_6_HOUR(url, {query})
	let dom = new JSDOM(resp.body, {contentType: 'text/xml'})

	let storyEls = [...dom.window.document.querySelectorAll('item')]
	return storyEls.map(convertRssItemToStory)
}

export async function fetchWpJson(url, query = {}) {
	const feed = await GET_6_HOUR(url, {query, json: true})
	return feed.body.map(convertWpJsonItemToStory)
}

const GET_RSS_FEED = mem(fetchRssFeed, {maxAge: ONE_HOUR})
const GET_WP_FEED = mem(fetchWpJson, {maxAge: ONE_HOUR})

export function convertRssItemToStory(item) {
	const authors = item.getAttribute('dc:creator') || ['Unknown Author']
	const categories = [...item.querySelectorAll('category')] || []

	const link = item.querySelector('link')
		? item.querySelector('link').textContent
		: null

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

	return {
		authors,
		categories,
		content,
		datePublished,
		excerpt,
		featuredImage: null,
		link,
		title,
	}
}

export function convertWpJsonItemToStory(item) {
	let author = item.author
	if (item._embedded && item._embedded.author) {
		let authorInfo = item._embedded.author.find(a => a.id === item.author)
		author = authorInfo ? authorInfo.name : 'Unknown Author'
	} else {
		author = 'Unknown Author'
	}

	let featuredImage = null
	if (item._embedded && item._embedded['wp:featuredmedia']) {
		let featuredMediaInfo = item._embedded['wp:featuredmedia'].find(
			m => m.id === item.featured_media && m.media_type === 'image',
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
		categories: [],
		content: item.content.rendered,
		datePublished: item.date_gmt,
		excerpt: JSDOM.fragment(item.excerpt.rendered).textContent,
		featuredImage: featuredImage,
		link: item.link,
		title: JSDOM.fragment(item.title.rendered).textContent,
	}
}

async function noonNewsBulletein() {
	let resp = await GET_6_HOUR(
		'https://apps.carleton.edu/campact/nnb/show.php3',
		{query: {style: 'rss'}},
	)
	let dom = new JSDOM(resp.body, {contentType: 'text/xml'})

	let bulletinEls = [...dom.window.document.querySelectorAll('item')]
	let bulletins = bulletinEls.map(item => {
		let description = item.querySelector('description').textContent
		description = JSDOM.fragment(description).textContent.trim()
		let category = item.querySelector('category').textContent
		category = JSDOM.fragment(category).textContent.trim()
		return {description, category}
	})

	const grouped = groupBy(bulletins, m => m.category)
	return toPairs(grouped).map(([key, value]) => ({title: key, data: value}))
}

const NOON_NEWS_BULLETEIN = mem(noonNewsBulletein, {maxAge: ONE_HOUR})

export async function nnb(ctx) {
	ctx.body = await NOON_NEWS_BULLETEIN()
}

export async function rss(ctx) {
	ctx.body = await GET_RSS_FEED(ctx.query.url)
}

export async function wpJson(ctx) {
	ctx.body = await GET_WP_FEED(ctx.query.url)
}

export async function carletonNow(ctx) {
	let url = 'https://apps.carleton.edu/media_relations/feeds/blogs/news'
	ctx.body = await GET_RSS_FEED(url)
}
export async function carletonian(ctx) {
	let url = 'https://apps.carleton.edu/carletonian/feeds/blogs/tonian'
	ctx.body = await GET_RSS_FEED(url)
}
export async function krlxNews(ctx) {
	let url = 'https://www.krlx.org/wp-json/wp/v2/posts/'
	ctx.body = await GET_WP_FEED(url, {per_page: 10, _embed: true})
}
