/* eslint-disable camelcase */

import {get} from '../ccc-lib/index.js'
import moment from 'moment-timezone'
import lodash from 'lodash'
import getUrls from 'get-urls'
import _jsdom from 'jsdom'
const {JSDOM} = _jsdom
const {dropWhile, dropRightWhile, sortBy} = lodash

const TZ = 'US/Central'

function* expandReasonEvent(event, now = moment()) {
	let {
		id,
		name,
		contact_username,
		sponsor,
		end_date,
		location,
		description,
		datetime: start_date,
		url,
		dates,
		hours,
		minutes,
		recurrence,
	} = event

	let originalStartDate = moment.tz(start_date, TZ)

	if (recurrence === 'daily') {
		let naturalEndDate = moment.tz(end_date, TZ)

		let thisStartDate = originalStartDate.clone()

		let thisEndDate = thisStartDate
			.clone()
			.add(hours, 'hours')
			.add(minutes, 'minutes')

		if (naturalEndDate.year() !== 0) {
			thisEndDate = thisEndDate
				.clone()
				.year(naturalEndDate.year())
				.month(naturalEndDate.month())
				.date(naturalEndDate.date())
		}

		let isMidnightStart =
			thisStartDate.hours() === 0 && thisStartDate.minutes() === 0
		if (!isMidnightStart && thisEndDate.isBefore(now)) {
			return
		}

		yield {
			id,
			startTime: thisStartDate.toISOString(),
			endTime: thisEndDate.toISOString(),
			contact: contact_username,
			name,
			sponsor,
			location,
			description,
			url,
		}
		return
	}

	let todayDate = now.format('YYYY-MM-DD')
	let futureDate = now.clone().add(60, 'days').format('YYYY-MM-DD')

	let filteredDates = dropWhile(dates, (d) => d < todayDate)
	filteredDates = dropRightWhile(filteredDates, (d) => d > futureDate)

	for (let date of filteredDates) {
		let [y, m, d] = date.split('-')

		let thisStartDate = originalStartDate
			.clone()
			.year(parseInt(y, 10))
			.month(parseInt(m, 10) - 1)
			.date(parseInt(d, 10))

		let thisEndDate = thisStartDate
			.clone()
			.add(hours, 'hours')
			.add(minutes, 'minutes')

		let isMidnightStart =
			thisStartDate.hours() === 0 && thisStartDate.minutes() === 0
		if (!isMidnightStart && thisEndDate.isBefore(now)) {
			return
		}

		yield {
			id,
			startTime: thisStartDate.toISOString(),
			endTime: thisEndDate.toISOString(),
			contact: contact_username,
			name,
			sponsor,
			location,
			description,
			url,
		}
	}
}

function convertReasonEvent(event, now = moment()) {
	let ongoing =
		moment(event.startTime).isBefore(now, 'day') &&
		moment(event.endTime).isSameOrAfter(now)

	let description = (event.description || '').replace('<br>', '\n')
	description = JSDOM.fragment(description).textContent.trim()

	let links = description ? [...getUrls(description)] : []

	return {
		dataSource: 'reason',
		startTime: event.startTime,
		endTime: event.endTime,
		title: event.name || '',
		description: description,
		location: event.location || '',
		links: links,
		isOngoing: ongoing,
		metadata: {
			reasonId: event.id,
		},
		config: {
			startTime: true,
			endTime: true,
			subtitle: 'location',
		},
	}
}

export async function reasonCalendar(calendarUrl, now = moment()) {
	let dateParams = {
		// eslint-disable-next-line camelcase
		start_date: now.clone().format('YYYY-MM-DD'),
		// eslint-disable-next-line camelcase
		end_date: now.clone().add(1, 'month').format('YYYY-MM-DD'),
	}

	let params = Object.assign({}, dateParams, {format: 'json'})

	let body = await get(calendarUrl, {searchParams: params}).json()

	let events = []
	for (let event of body) {
		events = [...events, ...Array.from(expandReasonEvent(event, now))]
	}

	// strip out any events that were filtered out
	events = events.filter(Boolean)

	// sort the events
	events = sortBy(events, (event) => event.startTime)

	// return events
	return events.map((event) => convertReasonEvent(event, now))
}
