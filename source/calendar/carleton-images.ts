import * as Sentry from '@sentry/node'
import moment from 'moment-timezone'
import {getText} from '../ccc-lib/http.ts'
import {carletonPage, carletonSpan, eventImages, withEventImages} from './carleton-images-shape.ts'
import {ical} from './ical.ts'

export {eventCode, eventImages, withEventImages} from './carleton-images-shape.ts'

/// The images are a nicety: a page that fails to load, or changes shape, leaves
/// the calendar without pictures rather than without events.
export async function fetchEventImages(pageUrl: URL): Promise<Map<string, string>> {
	try {
		return eventImages(await getText(pageUrl), pageUrl)
	} catch (error) {
		console.error(`Failed to fetch event images from ${pageUrl.href}:`, error)
		Sentry.captureException(error, {tags: {url: pageUrl.href}})
		return new Map()
	}
}

/// One of Carleton's calendars: its feed's events for the next month, with the
/// pictures its page shows.
export async function carletonCalendar(feedUrl: string, pageUrl: string, now = moment()) {
	let {today, maxEndDate} = carletonSpan(now)

	let [events, images] = await Promise.all([
		ical(feedUrl, {maxEndDate}, now),
		fetchEventImages(carletonPage(pageUrl, today, maxEndDate)),
	])
	return withEventImages(events, images)
}
