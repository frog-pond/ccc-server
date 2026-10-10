import moment from 'moment-timezone'
import {z} from 'zod'
import {getJson} from '../ccc-lib/http.ts'
import {WeeklyScheduleSchema, weeklyScheduleEvents} from './weekly-schedule-shape.ts'

export {WeeklyScheduleSchema, weeklyScheduleEvents} from './weekly-schedule-shape.ts'
export type {WeeklySchedule} from './weekly-schedule-shape.ts'

/** The events of the weekly schedule published at `url`. */
export async function weeklySchedule(url: string, now = moment()) {
	let body = z.object({data: WeeklyScheduleSchema}).parse(await getJson(url))
	return weeklyScheduleEvents(body.data, now)
}
