import got from 'got'
import mem from 'mem'
import _jsdom from 'jsdom'
import url from 'url'
import qs from 'querystring'
import lodash from 'lodash'
import htmlEntities from 'html-entities'
const {groupBy, toPairs} = lodash
const {JSDOM} = _jsdom
const entities = new htmlEntities.AllHtmlEntities()

const GET_BASE = (url, opts) => got.get(url, Object.assign({
	headers: {
		'User-Agent': `ccc-server/1 (https://github.com/frog-pond/ccc-server)`
	},
}, opts))

const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = ONE_HOUR * 24
const ONE_WEEK = ONE_DAY * 7
const GET = mem(GET_BASE, {maxAge: ONE_DAY})
const GET_HOUR = mem(GET_BASE, {maxAge: ONE_HOUR})
const GET_6_HOUR = mem(GET_BASE, {maxAge: ONE_HOUR * 6})
const GET_WEEK = mem(GET_BASE, {maxAge: ONE_WEEK})

async function noonNewsBulletein() {
	let resp = await GET_6_HOUR('https://apps.carleton.edu/campact/nnb/show.php3?style=rss')
	let dom = new JSDOM(resp.body, {contentType: 'text/xml'})

	let bulletins = [...dom.window.document.querySelectorAll('item')]
		.map(item => {
			let description = item.querySelector('description').textContent.trim()
			description = entities.decode(description)
			// <category>Today</category> or <category>Wednesday, May 1</category>
			let category = item.querySelector('category').textContent.trim()
			category = entities.decode(category)
			return {description, category}
		})

	const grouped = groupBy(bulletins, m => m.category)
	return toPairs(grouped).map(([key, value]) => ({title: key, data: value}))
}

const NOON_NEWS_BULLETEIN = mem(noonNewsBulletein, {maxAge: ONE_HOUR})

export async function nnb(ctx) {
	ctx.body = await NOON_NEWS_BULLETEIN()
}
