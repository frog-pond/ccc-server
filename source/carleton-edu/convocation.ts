import {z} from 'zod'
import {JSDOM} from 'jsdom'
import moment from 'moment/moment.js'
import {get} from '../ccc-lib/http.js'
import assert from 'node:assert/strict'
import {htmlToMarkdown} from '../ccc-lib/html-to-markdown.js'
import {makeAbsoluteUrl} from '../ccc-lib/url.js'

const archiveBase = 'https://feed.podbean.com/carletonconvos/feed.xml'

export type ConvocationEpisodeType = z.infer<typeof ConvocationEpisodeSchema>
export const ConvocationEpisodeSchema = z.object({
	title: z.string(),
	description: z.string(),
	pubDate: z.string().datetime(),
	enclosure: z.nullable(
		z.object({
			url: z.string().url(),
			length: z.string(),
			type: z.string(),
		}),
	),
})

export type UpcomingConvocationEventType = z.infer<typeof UpcomingConvocationEventSchema>
export const UpcomingConvocationEventSchema = z.object({
	sponsor: z.string(),
	content: z.string(),
	images: z.string().url().array(),
})

function processConvocation(event: Element): ConvocationEpisodeType {
	let title = JSDOM.fragment(event.querySelector('title')?.textContent ?? '').textContent?.trim() ?? ''

	let description = JSDOM.fragment(event.querySelector('description')?.textContent ?? '').textContent?.trim() ?? ''

	let pubDate = moment(event.querySelector('pubDate')?.textContent).toISOString()

	let enclosureEl = event.querySelector('enclosure')
	let enclosure = enclosureEl
		? {
				type: enclosureEl.getAttribute('type') ?? '',
				url: enclosureEl.getAttribute('url') ?? '',
				length: enclosureEl.getAttribute('length') ?? '',
			}
		: null

	return ConvocationEpisodeSchema.parse({title, description, pubDate, enclosure})
}

export async function fetchArchived(): Promise<ConvocationEpisodeType[]> {
	let body = await get(archiveBase).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let convos = Array.from(dom.window.document.querySelectorAll('rss channel item')).map(processConvocation)
	return Promise.all(convos.slice(0, 100))
}

export async function fetchUpcomingDetail(eventId: string): Promise<UpcomingConvocationEventType> {
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

	return UpcomingConvocationEventSchema.parse({
		images,
		content: descText,
		sponsor: sponsorText,
	})
}
