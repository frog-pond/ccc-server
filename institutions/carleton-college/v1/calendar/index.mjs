import got from 'got'
import mem from 'mem'
import querystring from 'querystring'
import moment from 'moment'

const GET_BASE = (url, opts) =>
	got.get(
		url,
		Object.assign(
			{
				headers: {
					'User-Agent':
						'ccc-server/1 (https://github.com/frog-pond/ccc-server)',
				},
			},
			opts,
		),
	)

const ONE_HOUR = 60 * 60 * 1000
const GET_HOUR = mem(GET_BASE, {maxAge: ONE_HOUR})

function buildGoogleCalendarUrl(calendarId) {
	let calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
	let params = {
		maxResults: 50,
		orderBy: 'startTime',
		showDeleted: false,
		singleEvents: true,
		timeMin: new Date().toISOString(),
		key: process.env.GOOGLE_CALENDAR_API_KEY,
	}
	return `${calendarUrl}?${querystring.stringify(params)}`
}

function convertGoogleEvents(data, now=moment()) {
	let events = data.map(event => {
		const startTime = moment(event.start.date || event.start.dateTime)
		const endTime = moment(event.end.date || event.end.dateTime)

		return {
			startTime,
			endTime,
			title: event.summary || '',
			description: event.description || '',
			location: event.location || '',
			isOngoing: startTime.isBefore(now, 'day'),
			config: {
				startTime: true,
				endTime: true,
				subtitle: 'location',
			},
		}
	})

	return events
}

async function getGoogleCalendar(calendarId) {
	let url = buildGoogleCalendarUrl(calendarId)
	let resp = await GET_HOUR(url, {json: true})
	return convertGoogleEvents(resp.body.items)
}

function buildReasonCalendarUrl(calendarUrl, now=moment()) {
	let params = Object.assign({}, {
		// eslint-disable-next-line camelcase
		start_date: now.clone().format('YYYY-MM-DD'),
		// eslint-disable-next-line camelcase
		end_date: now
			.clone()
			.add(1, 'month')
			.format('YYYY-MM-DD'),
		},
		{format: 'json'},
	)
	return `${calendarUrl}?${querystring.stringify(params)}`
}

function convertReasonEvents(data, now=moment()) {
	let events = data.map(event => {
		const startTime = moment(event.datetime)
		const endTime = startTime
			.clone()
			.add(event.hours, 'hours')
			.add(event.minutes, 'minutes')

		return {
			startTime,
			endTime,
			title: event.name || '',
			description: event.description || '',
			location: event.location || '',
			isOngoing: startTime.isBefore(now, 'day') && endTime.isSameOrAfter(now),
			metadata: {
				reasonId: event.id,
			},
			config: {
				startTime: true,
				endTime: true,
				subtitle: 'location',
			},
		}
	})

	return events
}

async function getReasonCalendar(calendarUrl) {
	let url = buildReasonCalendarUrl(calendarUrl)
	let resp = await GET_HOUR(url, {json: true})
	return convertReasonEvents(resp.body)
}

const GET_GOOGLE_CALENDAR = mem(getGoogleCalendar, {maxAge: ONE_HOUR})
const GET_REASON_CALENDAR = mem(getReasonCalendar, {maxAge: ONE_HOUR})

export async function googleCalendar(ctx) {
	let {calendarId} = ctx.params
	ctx.body = await GET_GOOGLE_CALENDAR(calendarId)
}

export async function carletonCalendar(ctx) {
	let url = 'https://apps.carleton.edu/calendar/'
	ctx.body = await GET_REASON_CALENDAR(url)
}

export async function caveCalendar(ctx) {
	let url = 'https://apps.carleton.edu/student/orgs/cave/calendar/'
	ctx.body = await GET_REASON_CALENDAR(url)
}

export async function stolafCalendar(ctx) {
	let id = '5g91il39n0sv4c2bjdv1jrvcpq4ulm4r@import.calendar.google.com'
	ctx.body = await GET_GOOGLE_CALENDAR(id)
}

export async function northfieldCalendar(ctx) {
	let id = 'thisisnorthfield@gmail.com'
	ctx.body = await GET_GOOGLE_CALENDAR(id)
}
