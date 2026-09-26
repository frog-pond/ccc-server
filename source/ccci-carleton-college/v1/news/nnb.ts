import {getText} from '../../../ccc-lib/http.ts'
import {parseXml, textFromHtml} from '../../../ccc-lib/dom.ts'
import {groupBy, toPairs} from 'lodash-es'

export async function noonNewsBulletin() {
	let body = await getText('https://apps.carleton.edu/campact/nnb/show.php3', {
		searchParams: {style: 'rss'},
	})
	let doc = parseXml(body)

	let bulletinEls = [...doc.querySelectorAll('item')]
	let bulletins = bulletinEls.map((item) => {
		let description = item.querySelector('description')?.textContent ?? ''
		description = textFromHtml(description)
		let category = item.querySelector('category')?.textContent ?? ''
		category = textFromHtml(category)
		return {description, category}
	})

	const grouped = groupBy(bulletins, (m) => m.category)
	return toPairs(grouped).map(([key, value]) => ({title: key, data: value}))
}
