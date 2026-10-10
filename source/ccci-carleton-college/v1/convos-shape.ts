import {makeAbsoluteUrl} from '../../ccc-lib/url.ts'
import {htmlToMarkdown} from '../../ccc-lib/html-to-markdown.ts'
import {parseHtml, parseXml, textFromHtml} from '../../ccc-lib/dom.ts'
import moment from 'moment'
import assert from 'node:assert/strict'

/// Where a convocation's details are read: its page on the convocations
/// calendar, by the calendar's event id (`eId`).
export const CONVOS_CALENDAR_URL = 'https://www.carleton.edu/convocations/calendar/'

/// The convocations podcast, which the archived convos are read from.
export const CONVOS_PODCAST_URL = 'https://feed.podbean.com/carletonconvos/feed.xml'

function processConvo(event: Element) {
	let title = textFromHtml(event.querySelector('title')?.textContent ?? '')

	let description = textFromHtml(event.querySelector('description')?.textContent ?? '')

	let pubDate = moment(event.querySelector('pubDate')?.textContent)

	let enclosureEl = event.querySelector('enclosure')
	let enclosure = enclosureEl
		? {
				type: enclosureEl.getAttribute('type') ?? '',
				url: enclosureEl.getAttribute('url') ?? '',
				length: enclosureEl.getAttribute('length') ?? '',
			}
		: null

	return {title, description, pubDate, enclosure}
}

/// An element's contents as Markdown. The element is handed over parsed, so
/// no DOM of turndown's own is needed to read it (the Worker has none).
function markdownOf(element: Element | null, baseUrl: string) {
	return element ? htmlToMarkdown(element as HTMLElement, {baseUrl}) : ''
}

/// A convocation's images, description and sponsor, from its calendar page.
export function upcomingFrom(body: string) {
	let baseUrl = CONVOS_CALENDAR_URL
	let dom = parseHtml(body)

	let eventEl = dom.querySelector('.campus-calendar--event')
	assert(eventEl)

	let descText = markdownOf(eventEl.querySelector('.event_description'), baseUrl)

	let images = Array.from(eventEl.querySelectorAll('.single_event_image a'))
		.flatMap((imgLink) => {
			let href = imgLink.getAttribute('href')
			return href ? [href] : []
		})
		.map((href) => makeAbsoluteUrl(href, {baseUrl}))

	let sponsorText = markdownOf(eventEl.querySelector('.sponsorContactInfo'), baseUrl)

	return {
		images,
		content: descText,
		sponsor: sponsorText,
	}
}

/// The latest hundred convocations in the podcast feed.
export function archivedFrom(body: string) {
	let dom = parseXml(body)
	let convos = Array.from(dom.querySelectorAll('rss channel item')).map(processConvo)
	convos = convos.slice(0, 100)
	return convos
}
