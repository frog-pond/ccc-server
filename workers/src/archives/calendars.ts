import moment from 'moment-timezone'
import {eventsFromGoogle} from '../../../source/calendar/google-shape.ts'
import {eventsFromIcal} from '../../../source/calendar/ical-shape.ts'
import type {EventType} from '../../../source/calendar/types.ts'
import {registerArchive} from '../archive.ts'
import {clock} from '../clock.ts'
import {eventsFromPresence} from '../sources/presence-shape.ts'
import {TecPageSchema, eventsFromTec} from '../sources/tec-shape.ts'
import {TEC_MAX_PAGES, fetchFrom, icalText} from '../sources/calendars.ts'

/// Which calendar an archive keeps, and how its history is read.
export type CalendarArchiveParams =
	| {kind: 'ical'; url: string}
	| {kind: 'google'; calendarId: string}
	| {kind: 'tec'; url: string}
	| {kind: 'presence'; url: string}

/// How far back a Google calendar's history is read: a calendar of weekly
/// shows lists each week's, which adds up fast.
const GOOGLE_HISTORY = 365 * 24 * 60 * 60 * 1000
/// A Tribe calendar's history is read a month at a time, back until this many
/// months in a row have no events.
const TEC_EMPTY_MONTHS = 12

/// The beginning of time, as far as the shapers go: shaped against it, no
/// event is left out as past. Whether one is on now is worked out again when
/// it is answered.
const LONG_AGO = () => moment(0)

/// A calendar's events, kept by their source's id (or title) and start, so
/// each date of a repeating event is its own row.
export const calendarArchive = registerArchive({
	name: 'calendar',
	key: (params: CalendarArchiveParams) =>
		params.kind === 'google' ? `google ${params.calendarId}` : `${params.kind} ${params.url}`,
	id: (event: EventType) => {
		let uid = (event.metadata as {uid?: unknown} | undefined)?.uid
		return `${typeof uid === 'string' ? uid : event.title} ${event.startTime}`
	},
	at: (event: EventType) => Date.parse(event.startTime),
	async backfill(params, env, cursor) {
		switch (params.kind) {
			case 'ical': {
				// a feed lists all the events it publishes, past ones included
				let events = eventsFromIcal(
					await icalText(params.url),
					params.url,
					{onlyFuture: false},
					LONG_AGO(),
				)
				return {items: events, next: null}
			}
			case 'presence': {
				let response = await fetchFrom(new Set(['api.presence.io']), params.url)
				return {items: eventsFromPresence(await response.json(), LONG_AGO()), next: null}
			}
			case 'google': {
				let key = env.GOOGLE_CALENDAR_API_KEY
				if (!key) throw new Error('GOOGLE_CALENDAR_API_KEY is not set')
				let now = clock.now()
				let url = new URL(
					`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events`,
				)
				url.search = new URLSearchParams({
					maxResults: '250',
					orderBy: 'startTime',
					showDeleted: 'false',
					singleEvents: 'true',
					timeMin: new Date(now - GOOGLE_HISTORY).toISOString(),
					timeMax: new Date(now).toISOString(),
					...(cursor ? {pageToken: cursor} : {}),
					key,
				}).toString()
				let body = (await (await fetchFrom(new Set(['www.googleapis.com']), url.href)).json()) as {
					nextPageToken?: unknown
				}
				let next = typeof body.nextPageToken === 'string' ? body.nextPageToken : null
				return {items: eventsFromGoogle(body, LONG_AGO()), next}
			}
			case 'tec': {
				// cursor: how many months back this step reads, and how many
				// months in a row before it had no events
				let [back = 1, empty = 0] = (cursor ?? '1 0').split(' ').map(Number)
				let today = moment(clock.now()).tz('America/Chicago')
				let first = new URL(params.url)
				first.searchParams.set('per_page', '50')
				first.searchParams.set(
					'ends_after',
					today.clone().subtract(back, 'months').subtract(1, 'day').format('YYYY-MM-DD'),
				)
				first.searchParams.set(
					'starts_before',
					today
						.clone()
						.subtract(back - 1, 'months')
						.format('YYYY-MM-DD'),
				)
				let raw: unknown[] = []
				let next: string | undefined = first.href
				for (let count = 0; next; count++) {
					if (count === TEC_MAX_PAGES) {
						throw new Error(`The Tribe feed ran past ${String(TEC_MAX_PAGES)} pages`)
					}
					let response: Response = await fetchFrom(new Set(['wp.stolaf.edu']), next)
					let page = TecPageSchema.parse(await response.json())
					raw.push(...page.events)
					next = page.next_rest_url
				}
				let events = eventsFromTec(raw, LONG_AGO())
				let empties = events.length === 0 ? empty + 1 : 0
				return {
					items: events,
					next: empties >= TEC_EMPTY_MONTHS ? null : `${String(back + 1)} ${String(empties)}`,
				}
			}
		}
	},
})

/// Whether an event is on now, as the shapers work it out when they read it:
/// it started before today.
export const asOf = (event: EventType, now: number): EventType => ({
	...event,
	isOngoing: moment(event.startTime).isBefore(moment(now), 'day'),
})
