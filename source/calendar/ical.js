import {get} from '../ccc-lib/http.js'
import moment from 'moment'
import getUrls from 'get-urls'
import {JSDOM} from 'jsdom'
import InternetCalendar from 'ical.js'
import {Event} from './types.js'
import lodash from 'lodash'

const {sortBy} = lodash

/**
 * @param {InternetCalendar.Event[]} data
 * @param {typeof moment} now
 * @returns {Event[]}
 */
function convertEvents(data, now = moment()) {
	return data.map((event) => {
		const startTime = moment(event.startDate.toString())
		const endTime = moment(event.endDate.toString())
		let description = JSDOM.fragment(event.description || '').textContent.trim()

		return Event.parse({
			dataSource: 'ical',
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			title: event.summary,
			description: description,
			location: event.location,
			isOngoing: startTime.isBefore(now, 'day'),
			links: [...getUrls(description)],
			metadata: {
				uid: event.uid,
			},
			config: {
				startTime: true,
				endTime: true,
				subtitle: 'location',
			},
		})
	})
}

export async function ical(url, {onlyFuture = true} = {}, now = moment()) {
	let body = await get(url, {headers: {accept: 'text/calendar'}}).text()

	let comp = InternetCalendar.Component.fromString(body)
	let events = comp
		.getAllSubcomponents('vevent')
		.map((vevent) => new InternetCalendar.Event(vevent))

	if (onlyFuture) {
		events = events.filter((event) =>
			moment(event.endDate.toString()).isAfter(now, 'day'),
		)
	}

	return sortBy(convertEvents(events, now), (event) => event.startTime)
}
