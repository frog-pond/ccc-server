import moment from 'moment-timezone'
import {z} from 'zod'
import {
	carletonPage,
	carletonSpan,
	eventImages,
	withEventImages,
} from '../../../source/calendar/carleton-images-shape.ts'
import {eventsFromGoogle} from '../../../source/calendar/google-shape.ts'
import {eventsFromIcal} from '../../../source/calendar/ical-shape.ts'
import {
	WeeklyScheduleSchema,
	weeklyScheduleEvents,
} from '../../../source/calendar/weekly-schedule-shape.ts'
import {clock} from '../clock.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {eventsFromPresence} from './presence-shape.ts'
import {TecPageSchema, eventsFromTec} from './tec-shape.ts'
import {upstream} from '../upstream.ts'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/// A calendar is as fresh as the Node server kept it: a minute.
const TTL = MINUTE

/// Calendars are shaped against the time they are loaded, so the clock the
/// sources go by is the one they are shaped by.
const now = () => moment(clock.now())

/// The url comes from this worker's own route table, and these sources must not
/// become a way to make the worker fetch anything: the host is checked, and a
/// redirect to another is not followed. Errors reach the apps and the logs, so
/// they name the address without its query, which can carry the Google key.
async function fetchFrom(hosts: ReadonlySet<string>, url: string, init: RequestInit = {}) {
	let parsed = new URL(url)
	let named = parsed.origin + parsed.pathname
	if (parsed.protocol !== 'https:' || !hosts.has(parsed.hostname)) {
		throw new Error(`${named} is not a calendar this reads`)
	}
	let response = await upstream(url, init)
	if (!response.ok) {
		throw new Error(`The calendar responded ${String(response.status)} for ${named}`)
	}
	return response
}

const ICAL_HOSTS = new Set(['www.northfieldmn.gov', 'www.carleton.edu'])
const icalText = async (url: string) =>
	(await fetchFrom(ICAL_HOSTS, url, {headers: {accept: 'text/calendar'}})).text()

export type IcalParams = {url: string}

/// An iCal feed's upcoming events, the way `ical` in source/calendar/ical.ts
/// reads it for the Node server.
export const ical = defineSource({
	name: 'calendar-ical',
	key: ({url}: IcalParams) => url,
	async load({url}) {
		return eventsFromIcal(await icalText(url), url, {}, now())
	},
	ttl: TTL,
	staleIfError: DAY,
})
registerSource(ical)

export type CarletonCalendarParams = {feedUrl: string; pageUrl: string}

/// One of Carleton's calendars: its feed's events for the next month, with the
/// pictures its page shows, the way `carletonCalendar` does for the Node
/// server. The pictures are a nicety: a page that fails to load, or changes
/// shape, leaves the calendar without pictures rather than without events.
export const carletonCalendar = defineSource({
	name: 'calendar-carleton',
	key: ({feedUrl, pageUrl}: CarletonCalendarParams) => `${feedUrl} ${pageUrl}`,
	async load({feedUrl, pageUrl}) {
		let at = now()
		let {today, maxEndDate} = carletonSpan(at)
		let page = carletonPage(pageUrl, today, maxEndDate)

		let [body, images] = await Promise.all([
			icalText(feedUrl),
			fetchFrom(ICAL_HOSTS, page.href)
				.then(async (response) => eventImages(await response.text(), page))
				.catch((error: unknown) => {
					console.error(`Failed to fetch event images from ${page.href}:`, error)
					return new Map<string, string>()
				}),
		])
		return withEventImages(eventsFromIcal(body, feedUrl, {maxEndDate}, at), images)
	},
	ttl: TTL,
	staleIfError: DAY,
})
registerSource(carletonCalendar)

export type GoogleCalendarParams = {calendarId: string}

/// A Google calendar's next fifty events, the way `googleCalendar` does for the
/// Node server. The key is a secret of this worker, not part of what is stored.
export const googleCalendar = defineSource({
	name: 'calendar-google',
	key: ({calendarId}: GoogleCalendarParams) => calendarId,
	async load({calendarId}, env) {
		let key = env.GOOGLE_CALENDAR_API_KEY
		if (!key) throw new Error('GOOGLE_CALENDAR_API_KEY is not set')

		let at = now()
		let url = new URL(
			`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
		)
		url.search = new URLSearchParams({
			maxResults: '50',
			orderBy: 'startTime',
			showDeleted: 'false',
			singleEvents: 'true',
			timeMin: at.toISOString(),
			key,
		}).toString()

		let response = await fetchFrom(new Set(['www.googleapis.com']), url.href)
		return eventsFromGoogle(await response.json(), at)
	},
	ttl: TTL,
	staleIfError: DAY,
})
registerSource(googleCalendar)

export type WeeklyScheduleParams = {url: string}

/// A station's week of shows, the way `weeklySchedule` does for the Node server.
export const weeklySchedule = defineSource({
	name: 'calendar-weekly-schedule',
	key: ({url}: WeeklyScheduleParams) => url,
	async load({url}) {
		let response = await fetchFrom(new Set(['stolaf.dev']), url)
		let body = z.object({data: WeeklyScheduleSchema}).parse(await response.json())
		return weeklyScheduleEvents(body.data, now())
	},
	ttl: TTL,
	staleIfError: DAY,
})
registerSource(weeklySchedule)

export type PresenceParams = {url: string}

/// St. Olaf's Presence events: a large list, so it is kept for five minutes
/// rather than one.
export const presence = defineSource({
	name: 'calendar-presence',
	key: ({url}: PresenceParams) => url,
	async load({url}) {
		let response = await fetchFrom(new Set(['api.presence.io']), url)
		return eventsFromPresence(await response.json(), now())
	},
	ttl: 5 * MINUTE,
	staleIfError: DAY,
})
registerSource(presence)

export type TecParams = {url: string}

/// The most pages of a feed this reads, at fifty events each. A feed longer than
/// that throws rather than come back short.
const TEC_MAX_PAGES = 10

/// An Events Calendar feed's events for the next month, in campus dates, across
/// all its pages. TEC's `start_date` filter would drop an exhibition that opened
/// last month, so `ends_after` and `starts_before` filter on overlap instead;
/// it rounds both up to 23:59:59 of the date given, so reaching an event that
/// ends early today takes yesterday's date.
export const tec = defineSource({
	name: 'calendar-tec',
	key: ({url}: TecParams) => url,
	async load({url}) {
		let at = now()
		let today = at.clone().tz('America/Chicago')
		let first = new URL(url)
		first.searchParams.set('per_page', '50')
		first.searchParams.set('ends_after', today.clone().subtract(1, 'day').format('YYYY-MM-DD'))
		first.searchParams.set('starts_before', today.clone().add(1, 'month').format('YYYY-MM-DD'))

		let events: unknown[] = []
		let next: string | undefined = first.href
		for (let count = 0; next; count++) {
			if (count === TEC_MAX_PAGES) {
				throw new Error(`The Tribe feed ran past ${String(TEC_MAX_PAGES)} pages`)
			}
			// each page names the next, so they are read in turn
			let response: Response = await fetchFrom(new Set(['wp.stolaf.edu']), next)
			let page = TecPageSchema.parse(await response.json())
			events.push(...page.events)
			next = page.next_rest_url
		}
		return eventsFromTec(events, at)
	},
	ttl: TTL,
	staleIfError: DAY,
})
registerSource(tec)
