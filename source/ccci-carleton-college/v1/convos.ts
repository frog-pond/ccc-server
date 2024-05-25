import {get} from '../../ccc-lib/http.js'
import {makeAbsoluteUrl} from '../../ccc-lib/url.js'
import {htmlToMarkdown} from '../../ccc-lib/html-to-markdown.js'
import {JSDOM} from 'jsdom'
import moment from 'moment'
import assert from 'node:assert/strict'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'
import {EventSchema} from '../../calendar/types.js'
import {CARLETON_UPCOMING_CONVOCATIONS_URL, getInternetCalendar} from './calendar.js'

const archiveBase = 'https://feed.podbean.com/carletonconvos/feed.xml'

type ConvocationEpisodeType = z.infer<typeof ConvocationEpisodeSchema>
const ConvocationEpisodeSchema = z.object({
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

type UpcomingConvocationEventType = z.infer<typeof UpcomingConvocationEventSchema>
const UpcomingConvocationEventSchema = z.object({
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

	return {title, description, pubDate, enclosure}
}

async function fetchUpcomingDetail(eventId: string): Promise<UpcomingConvocationEventType> {
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

async function fetchArchived() {
	let body = await get(archiveBase).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})
	let convos = Array.from(dom.window.document.querySelectorAll('rss channel item')).map(processConvocation)
	return Promise.all(convos.slice(0, 100))
}

export const getConvocationDetail = createRouteSpec({
	method: 'get',
	path: '/convos/upcoming/:id',
	validate: {
		params: z.object({id: z.string()}),
		response: UpcomingConvocationEventSchema,
	},
	handler: async (ctx) => {
		ctx.body = await fetchUpcomingDetail(ctx.request.params.id)
	},
})

export const getArchivedConvocations = createRouteSpec({
	method: 'get',
	path: '/convos/archived',
	validate: {response: ConvocationEpisodeSchema.array()},
	handler: async (ctx) => {
		ctx.body = await fetchArchived()
	},
})

export const getUpcomingConvocations = createRouteSpec({
	method: 'get',
	path: '/convos/upcoming',
	validate: {response: EventSchema.array()},
	handler: async (ctx) => {
		ctx.body = await getInternetCalendar(CARLETON_UPCOMING_CONVOCATIONS_URL)
	},
})
