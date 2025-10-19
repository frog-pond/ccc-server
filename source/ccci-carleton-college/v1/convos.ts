import {getText} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {makeAbsoluteUrl} from '../../ccc-lib/url.ts'
import {htmlToMarkdown} from '../../ccc-lib/html-to-markdown.ts'
import {JSDOM} from 'jsdom'
import moment from 'moment'
import type {Context} from '../../ccc-server/context.ts'
import assert from 'node:assert/strict'

function processConvo(event: Element) {
	let title = JSDOM.fragment(event.querySelector('title')?.textContent ?? '').textContent.trim()

	let description = JSDOM.fragment(
		event.querySelector('description')?.textContent ?? '',
	).textContent.trim()

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
	let body = await getText(url, {searchParams: {eId: eventId}})

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

export const getUpcoming = fetchUpcoming

export async function upcomingDetail(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)
	if (ctx.cached(ONE_HOUR * 6)) return

	let detailId = ctx.URL.searchParams.get('id')
	ctx.assert(detailId, 400, '?id is required')
	ctx.body = await getUpcoming(detailId)
}

async function fetchArchived() {
	let body = await getText('https://feed.podbean.com/carletonconvos/feed.xml')
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let convos = Array.from(dom.window.document.querySelectorAll('rss channel item')).map(
		processConvo,
	)
	convos = convos.slice(0, 100)
	return convos
}

export const getArchived = fetchArchived

export async function archived(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)
	if (ctx.cached(ONE_HOUR * 6)) return

	ctx.body = await getArchived()
}
