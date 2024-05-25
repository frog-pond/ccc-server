import {get} from '../../ccc-lib/http.js'
import {ONE_HOUR} from '../../ccc-lib/constants.js'
import {makeAbsoluteUrl} from '../../ccc-lib/url.js'
import {htmlToMarkdown} from '../../ccc-lib/html-to-markdown.js'
import mem from 'memoize'
import {JSDOM} from 'jsdom'
import moment from 'moment'
import type {Context} from '../../ccc-server/context.js'
import assert from 'node:assert/strict'

const archiveBase = 'https://feed.podbean.com/carletonconvos/feed.xml'

function processConvo(event: Element) {
	let title = JSDOM.fragment(event.querySelector('title')?.textContent ?? '').textContent?.trim()

	let description =
		JSDOM.fragment(event.querySelector('description')?.textContent ?? '').textContent?.trim() ?? ''

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

async function fetchUpcoming(eventId: string) {
	let baseUrl = 'https://www.carleton.edu/convocations/calendar/'
	let url = 'https://www.carleton.edu/convocations/calendar/'
	let body = await get(url, {searchParams: {eId: eventId}}).text()

	let dom = new JSDOM(body)

	let eventEl = dom.window.document.querySelector('.campus-calendar--event')
	assert(eventEl)

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

export const getUpcoming = mem(fetchUpcoming, {maxAge: ONE_HOUR * 6})

export async function upcomingDetail(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)

	let detailId = ctx.URL.searchParams.get('id')
	ctx.assert(detailId, 400, '?id is required')
	ctx.body = await getUpcoming(detailId)
}

async function fetchArchived() {
	let body = await get(archiveBase).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let convos = Array.from(dom.window.document.querySelectorAll('rss channel item')).map(
		processConvo,
	)
	convos = convos.slice(0, 100)
	return Promise.all(convos)
}

export const getArchived = mem(fetchArchived, {maxAge: ONE_HOUR * 6})

export async function archived(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)
	ctx.body = await getArchived()
}
