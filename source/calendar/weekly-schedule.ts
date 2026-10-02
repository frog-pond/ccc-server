import moment, {type Moment} from 'moment-timezone'
import {z} from 'zod'
import {getJson} from '../ccc-lib/http.ts'
import {EventSchema} from './types.ts'

/// A station's repeating week of shows, as AAO-React-Native publishes it (see
/// data/ksto-schedule.yaml in that repository), and the events it makes.

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

const ClockSchema = z.string().regex(/^([01]\d|2[0-4]):00$/)

const SlotSchema = z.object({
	day: z.enum(DAYS),
	start: ClockSchema,
	end: ClockSchema,
	title: z.string(),
	genre: z.string().optional(),
	poster: z.string().url().optional(),
})

export const WeeklyScheduleSchema = z.object({
	updated: z.string().datetime(),
	timezone: z.string(),
	shows: SlotSchema.array(),
})

export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>

/** How far ahead to list shows, and at most how many, as the Google reader does. */
const DAYS_AHEAD = 14
const MAX_EVENTS = 50

const hourOf = (clock: string) => Number(clock.slice(0, 2))

/** The moment `clock` falls on the station's calendar day `day`; 24:00 is the next midnight. */
function at(day: Moment, clock: string) {
	let hour = hourOf(clock)
	return hour === 24 ? day.clone().add(1, 'day').startOf('day') : day.clone().hour(hour)
}

/**
 * The shows still to come, or on air now, over the next two weeks, as events.
 * Each slot is a wall-clock time in the schedule's timezone, so a show keeps
 * its hour across a daylight-saving change.
 */
export function weeklyScheduleEvents(schedule: WeeklySchedule, now = moment()) {
	let today = now.clone().tz(schedule.timezone).startOf('day')

	let events = []
	for (let offset = 0; offset < DAYS_AHEAD; offset++) {
		let day = today.clone().add(offset, 'days')
		let weekday = DAYS[day.day()]
		for (let slot of schedule.shows) {
			if (slot.day !== weekday) continue
			let start = at(day, slot.start)
			let end = at(day, slot.end)
			if (!end.isAfter(now)) continue
			events.push({start, end, slot})
		}
	}

	return events
		.sort((a, b) => a.start.valueOf() - b.start.valueOf())
		.slice(0, MAX_EVENTS)
		.map(({start, end, slot}) =>
			EventSchema.parse({
				dataSource: 'weekly-schedule',
				startTime: start.toISOString(),
				endTime: end.toISOString(),
				title: slot.title,
				description: slot.genre ?? '',
				location: '',
				isOngoing: false,
				links: slot.poster ? [slot.poster] : [],
				config: {startTime: true, endTime: true, subtitle: 'location'},
			}),
		)
}

/** The events of the weekly schedule published at `url`. */
export async function weeklySchedule(url: string, now = moment()) {
	let body = z.object({data: WeeklyScheduleSchema}).parse(await getJson(url))
	return weeklyScheduleEvents(body.data, now)
}
