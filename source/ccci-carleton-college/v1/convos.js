import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {makeAbsoluteUrl} from '../../ccc-lib/url.js'
import {htmlToMarkdown} from '../../ccc-lib/html-to-markdown.js'
import {JSDOM} from 'jsdom'
import moment from 'moment'
import pMemoize from 'p-memoize'
import {ONE_HOUR_CACHE} from '../../ccc-lib/cache.js'

function processConvo(event) {
	let title = JSDOM.fragment(
		event.querySelector('title').textContent,
	).textContent.trim()

	let description = event.querySelector('description')
	description = description
		? JSDOM.fragment(
				event.querySelector('description').textContent,
			).textContent.trim()
		: ''

	let pubDate = moment(event.querySelector('pubDate').textContent)

	let enclosure = event.querySelector('enclosure')
	enclosure = enclosure
		? {
				type: enclosure.getAttribute('type')
					? enclosure.getAttribute('type')
					: '',
				url: enclosure.getAttribute('url') ? enclosure.getAttribute('url') : '',
				length: enclosure.getAttribute('length')
					? enclosure.getAttribute('length')
					: '',
			}
		: null

	return {title, description, pubDate, enclosure}
}

async function _getUpcoming(eventId) {
	let baseUrl = 'https://www.carleton.edu/convocations/calendar/'
	let url = 'https://www.carleton.edu/convocations/calendar/'
	let body = await get(url, {searchParams: {eId: String(eventId)}}).text()

	let dom = new JSDOM(body)

	let eventEl = dom.window.document.querySelector('.campus-calendar--event')

	let descEl = eventEl.querySelector('.event_description')
	let descText = descEl ? htmlToMarkdown(descEl, {baseUrl}) : ''

	let images = [...eventEl.querySelectorAll('.single_event_image a')]
		.map((imgLink) => imgLink.getAttribute('href'))
		.map((href) => makeAbsoluteUrl(href, {baseUrl}))

	let sponsor = eventEl.querySelector('.sponsorContactInfo')
	let sponsorText = sponsor ? htmlToMarkdown(sponsor, baseUrl) : ''

	return {
		images,
		content: descText,
		sponsor: sponsorText,
	}
}

export const getUpcoming = pMemoize(_getUpcoming, {cache: ONE_HOUR_CACHE})

export async function upcomingDetail(ctx) {
	ctx.cacheControl(ONE_HOUR * 6)

	ctx.body = await getUpcoming(ctx.params.id)
}

async function _getArchived() {
	let body = await get(
		'https://feed.podbean.com/carletonconvos/feed.xml',
	).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let items = dom.window.document.querySelectorAll('rss channel item')
	return Array.from(items).map(processConvo).slice(0, 100)
}

export const getArchived = pMemoize(_getArchived, {cache: ONE_HOUR_CACHE})

export async function archived(ctx) {
	ctx.cacheControl(ONE_HOUR * 6)
	ctx.body = await getArchived()
}
