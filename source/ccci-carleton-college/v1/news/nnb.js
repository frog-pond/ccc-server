import {get} from '../../../ccc-lib/http.js'
import _jsdom from 'jsdom'
import lodash from 'lodash'
const {groupBy, toPairs} = lodash
const {JSDOM} = _jsdom

export async function noonNewsBulletin() {
	let body = await get('https://apps.carleton.edu/campact/nnb/show.php3', {
		searchParams: {style: 'rss'},
	}).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})

	let bulletinEls = [...dom.window.document.querySelectorAll('item')]
	let bulletins = bulletinEls.map((item) => {
		let description = item.querySelector('description').textContent
		description = JSDOM.fragment(description).textContent.trim()
		let category = item.querySelector('category').textContent
		category = JSDOM.fragment(category).textContent.trim()
		return {description, category}
	})

	const grouped = groupBy(bulletins, (m) => m.category)
	return toPairs(grouped).map(([key, value]) => ({title: key, data: value}))
}
