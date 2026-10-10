import {deprecatedEvents} from '../../source/calendar/deprecated.ts'
import type {EventType} from '../../source/calendar/types.ts'
import {RETIRED_TITLE} from '../../source/ccc-lib/deprecated.ts'
import {itemsBefore} from './archive.ts'
import {calendarArchive, type CalendarArchiveParams} from './archives/calendars.ts'
import {fetchSource} from './client.ts'
import {clock} from './clock.ts'
import {
	carletonCalendar,
	googleCalendar,
	ical,
	presence,
	tec,
	weeklySchedule,
} from './sources/calendars.ts'

/// A calendar the apps read: its events, and for one that is kept, its
/// events from before a time, latest first.
export type Calendar = {
	read: (env: Env) => Promise<EventType[]>
	history?: (env: Env, before: number, limit: number) => Promise<EventType[]>
}

const live = (read: Calendar['read']): Calendar => ({read})

/// A calendar whose events are kept as they are read, and whose history is
/// read back to its start.
const kept = (read: Calendar['read'], params: CalendarArchiveParams): Calendar => ({
	read,
	history: (env, before, limit) => itemsBefore(env, calendarArchive, params, before, limit),
})

const fromIcal = (url: string) =>
	kept(async (env) => (await fetchSource(env, ical, {url})).value, {kind: 'ical', url})

const fromGoogle = (calendarId: string) =>
	kept(async (env) => (await fetchSource(env, googleCalendar, {calendarId})).value, {
		kind: 'google',
		calendarId,
	})

const fromWeeklySchedule = (url: string) =>
	live(async (env) => (await fetchSource(env, weeklySchedule, {url})).value)

const fromTec = (url: string) =>
	kept(async (env) => (await fetchSource(env, tec, {url})).value, {kind: 'tec', url})

const fromPresence = (url: string) =>
	kept(async (env) => (await fetchSource(env, presence, {url})).value, {kind: 'presence', url})

/// One of Carleton's calendars, with the pictures its page shows.
const fromCarleton = (path: string) => {
	let feedUrl = `https://www.carleton.edu${path}?loadFeed=calendar&stamp=${STAMPS[path]}`
	return kept(
		async (env) =>
			(
				await fetchSource(env, carletonCalendar, {
					feedUrl,
					pageUrl: `https://www.carleton.edu${path}`,
				})
			).value,
		{kind: 'ical', url: feedUrl},
	)
}

/// The `stamp` each of Carleton's feeds is asked with, as the Node server asks.
const STAMPS: Record<string, string> = {
	'/calendar/': '1714843628',
	'/convocations/calendar/': '1714843936',
	'/student/orgs/sumo/schedule/': '1714840383',
}

/// A notice in place of a calendar that is no longer published. It is shaped
/// for the renderers older builds already ship, so it is still events.
const notice = (title: string, text: string): Calendar => ({
	read: () => Promise.resolve(deprecatedEvents(title, text, new Date(clock.now()))),
})

const NORTHFIELD =
	'https://www.northfieldmn.gov/common/modules/iCalendar/iCalendar.aspx?catID=41&feed=calendar'

export const CONVOS = fromCarleton('/convocations/calendar/')

/// The Cave still runs, but its site moved to WordPress and took the calendar
/// feed with it. The route stays and answers with a notice, because the
/// clients calling it cannot be changed.
const THE_CAVE = notice(RETIRED_TITLE, 'The Cave calendar is no longer published.')

const OLEVILLE = notice(RETIRED_TITLE, 'The Oleville calendar is no longer published.')

/// Calendars that read the same wherever they are listed, by name.
const SHARED: Record<string, Calendar> = {
	carleton: fromCarleton('/calendar/'),
	'the-cave': THE_CAVE,
	oleville: OLEVILLE,
	northfield: fromIcal(NORTHFIELD),
	// KSTO's Google Calendar stopped at spring 2019; the station's current
	// schedule is published each week.
	'ksto-schedule': fromWeeklySchedule('https://stolaf.dev/AAO-React-Native/ksto-schedule.json'),
	'krlx-schedule': fromGoogle('krlxradio88.1@gmail.com'),
	// St. Olaf's own calendar, on The Events Calendar (Tribe).
	stolaf: fromTec('https://wp.stolaf.edu/calendar/wp-json/tribe/events/v1/events'),
	'upcoming-convos': CONVOS,
	'sumo-schedule': fromCarleton('/student/orgs/sumo/schedule/'),
}

/// St. Olaf's calendars.
export const STOLAF_CALENDARS: Record<string, Calendar> = {
	...SHARED,
	// The events St. Olaf's student organizations post to Presence.
	'student-orgs': fromPresence('https://api.presence.io/stolaf/v1/events'),
}

/// Carleton's calendars.
export const CARLETON_CALENDARS: Record<string, Calendar> = {...SHARED}
