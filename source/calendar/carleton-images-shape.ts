import moment from 'moment-timezone'
import {parseHtml} from '../ccc-lib/dom.ts'
import type {EventType} from './types.ts'

/// Carleton's iCal feeds carry no images; an event's picture is only on the
/// calendar's own web page. Each event there is an `event_list--item` whose
/// picture (when it has one) and title both link to `?eId=<code>`, and the
/// feed's DESCRIPTION ends with the same code as a `/_c/<code>` share link.
/// The code is how the two are joined.

/// Event code -> the image's full-size address. The page shows a 100x100 crop
/// (`?resize=…&crop=…` on the CDN); without the query the CDN serves the
/// original, which is what the event's own page links its lightbox to.
export function eventImages(html: string, pageUrl: string | URL): Map<string, string> {
	let images = new Map<string, string>()

	for (let item of parseHtml(html).querySelectorAll('.event_list--item')) {
		let link = item.querySelector('picture a[href*="eId="]')
		let src = link?.querySelector('img')?.getAttribute('src')
		let href = link?.getAttribute('href')
		if (!src || !href) continue

		let code = URL.parse(href, pageUrl)?.searchParams.get('eId')
		let image = URL.parse(src, pageUrl)
		if (!code || !image || images.has(code)) continue

		image.search = ''
		images.set(code, image.toString())
	}

	return images
}

/// Athletics events link to `/_c/undefined`: they have no code, and no picture.
export function eventCode(description: string): string | undefined {
	let code = /\/_c\/([A-Za-z0-9]+)\s*$/u.exec(description)?.[1]
	return code === 'undefined' ? undefined : code
}

export function withEventImages(events: EventType[], images: Map<string, string>): EventType[] {
	return events.map((event) => {
		let code = eventCode(event.description)
		let image = code ? images.get(code) : undefined
		return image ? {...event, image} : event
	})
}

/// The span of dates one of Carleton's calendars is asked for: the next month,
/// in campus dates. Each site's page lists a different span by default (three
/// days for the campus calendar, a month for SUMO, the year for Convo), so the
/// page is asked for the same span as the events. The span is inclusive and
/// lists events that began earlier and are still on, as the feed's events are.
export function carletonSpan(now = moment()) {
	let today = now.clone().tz('America/Chicago')
	return {today, maxEndDate: today.clone().add(1, 'month')}
}

/// The calendar's own page, asked for the same span as the events.
export function carletonPage(pageUrl: string, today: moment.Moment, maxEndDate: moment.Moment) {
	let page = new URL(pageUrl)
	page.searchParams.set('start_date', today.format('YYYY-MM-DD'))
	page.searchParams.set('end_date', maxEndDate.format('YYYY-MM-DD'))
	return page
}
