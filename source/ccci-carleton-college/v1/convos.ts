import {getText} from '../../ccc-lib/http.ts'
import {makeAbsoluteUrl} from '../../ccc-lib/url.ts'
import {htmlToMarkdown} from '../../ccc-lib/html-to-markdown.ts'
import {parseHtml, parseXml, textFromHtml} from '../../ccc-lib/dom.ts'
import {requireQuery} from '../../ccc-worker/query.ts'
import moment from 'moment'
import type {Context} from '../../ccc-worker/env.ts'

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

export function parseUpcomingConvo(html: string, pageUrl: string) {
	let baseUrl = 'https://www.carleton.edu/convocations/calendar/'

	let eventEl = parseHtml(html).querySelector('.campus-calendar--event')
	if (!eventEl) {
		throw new Error(`no .campus-calendar--event element in ${pageUrl}`)
	}

	let descText = htmlToMarkdown(eventEl.querySelector('.event_description')?.innerHTML ?? '', {
		baseUrl,
	})

	let images = Array.from(eventEl.querySelectorAll('.single_event_image a'))
		.flatMap((imgLink) => {
			let href = imgLink.getAttribute('href')
			return href ? [href] : []
		})
		.map((href) => makeAbsoluteUrl(href, {baseUrl}))

	let sponsorText = htmlToMarkdown(eventEl.querySelector('.sponsorContactInfo')?.innerHTML ?? '', {
		baseUrl,
	})

	return {
		images,
		content: descText,
		sponsor: sponsorText,
	}
}

async function fetchUpcoming(eventId: string) {
	let url = new URL('https://www.carleton.edu/convocations/calendar/')
	url.searchParams.set('eId', eventId)
	return parseUpcomingConvo(await getText(url), url.href)
}

export const getUpcoming = fetchUpcoming

export async function upcomingDetail(c: Context) {
	let detailId = requireQuery(c, 'id')
	return c.json(await getUpcoming(detailId))
}

async function fetchArchived() {
	let body = await getText('https://feed.podbean.com/carletonconvos/feed.xml')
	let doc = parseXml(body)
	let convos = Array.from(doc.querySelectorAll('rss channel item')).map(processConvo)
	convos = convos.slice(0, 100)
	return convos
}

export const getArchived = fetchArchived

export async function archived(c: Context) {
	return c.json(await getArchived())
}
