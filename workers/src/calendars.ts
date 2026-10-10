import {deprecatedEvents} from '../../source/calendar/deprecated.ts'
import type {EventType} from '../../source/calendar/types.ts'
import {RETIRED_TITLE} from '../../source/ccc-lib/deprecated.ts'
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

const MINUTE = 60
const DAY = 24 * 60 * MINUTE

/// A calendar the apps read: its events, and how long they are told to keep them.
export type Calendar = {
	read: (env: Env) => Promise<EventType[]>
	maxAge: number
}

const live = (read: Calendar['read']): Calendar => ({read, maxAge: MINUTE})

const fromIcal = (url: string) => live(async (env) => (await fetchSource(env, ical, {url})).value)

const fromGoogle = (calendarId: string) =>
	live(async (env) => (await fetchSource(env, googleCalendar, {calendarId})).value)

const fromWeeklySchedule = (url: string) =>
	live(async (env) => (await fetchSource(env, weeklySchedule, {url})).value)

const fromTec = (url: string) => live(async (env) => (await fetchSource(env, tec, {url})).value)

const fromPresence = (url: string): Calendar => ({
	read: async (env) => (await fetchSource(env, presence, {url})).value,
	maxAge: 5 * MINUTE,
})

/// One of Carleton's calendars, with the pictures its page shows.
const fromCarleton = (path: string) =>
	live(
		async (env) =>
			(
				await fetchSource(env, carletonCalendar, {
					feedUrl: `https://www.carleton.edu${path}?loadFeed=calendar&stamp=${STAMPS[path]}`,
					pageUrl: `https://www.carleton.edu${path}`,
				})
			).value,
	)

/// The `stamp` each of Carleton's feeds is asked with, as the Node server asks.
const STAMPS: Record<string, string> = {
	'/calendar/': '1714843628',
	'/convocations/calendar/': '1714843936',
	'/student/orgs/sumo/schedule/': '1714840383',
}

/// A notice in place of a calendar that is no longer published. It is shaped
/// for the renderers older builds already ship, so it is still events.
const notice = (title: string, text: string, maxAge: number): Calendar => ({
	read: () => Promise.resolve(deprecatedEvents(title, text, new Date(clock.now()))),
	maxAge,
})

const NORTHFIELD =
	'https://www.northfieldmn.gov/common/modules/iCalendar/iCalendar.aspx?catID=41&feed=calendar'

export const CONVOS = fromCarleton('/convocations/calendar/')

/// The Cave still runs, but its site moved to WordPress and took the calendar
/// feed with it. The route stays and answers with a notice, because the
/// clients calling it cannot be changed.
const THE_CAVE = notice(RETIRED_TITLE, 'The Cave calendar is no longer published.', DAY)

const OLEVILLE = notice(RETIRED_TITLE, 'The Oleville calendar is no longer published.', DAY)

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
	'upcoming-convos': CONVOS,
	'sumo-schedule': fromCarleton('/student/orgs/sumo/schedule/'),
}

/// St. Olaf's calendars.
export const STOLAF_CALENDARS: Record<string, Calendar> = {
	...SHARED,
	// The events St. Olaf's student organizations post to Presence.
	'student-orgs': fromPresence('https://api.presence.io/stolaf/v1/events'),
	// The college's own calendar, on The Events Calendar (Tribe).
	stolaf: fromTec('https://wp.stolaf.edu/calendar/wp-json/tribe/events/v1/events'),
}

/// Carleton's calendars.
export const CARLETON_CALENDARS: Record<string, Calendar> = {
	...SHARED,
	// The Google calendar this mirrored St. Olaf's events through was deleted.
	stolaf: notice(RETIRED_TITLE, 'St. Olaf events are no longer published to Carleton.', DAY),
}
