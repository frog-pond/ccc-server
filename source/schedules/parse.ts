import {z} from 'zod'
import type {BreakCalendar, AuthoredSpace} from './types.ts'

// AAO validates authored content and normalizes YAML before publishing. Here we
// check the containers expansion needs, leaving service contents opaque.
const text = z.string()
const date = z.string()
const services = z.array(z.unknown())
const exceptions = z.array(z.looseObject({date, schedule: services}))
const policy = z.looseObject({schedule: services, exceptions})
const reference = z.union([text, policy])
const templates = z.record(text, policy)
const breakFields = {
	name: text,
	templates: templates.optional(),
	defaultSpaceSchedule: reference.optional(),
}
const calendarSchema = z.looseObject({
	timezone: text,
	templates: templates.optional(),
	breaks: z.record(
		text,
		z.union([
			z.looseObject({...breakFields, date, start: z.never().optional(), end: z.never().optional()}),
			z.looseObject({...breakFields, start: date, end: date, date: z.never().optional()}),
		]),
	),
})
// Space metadata is retained, including fields added by future upstream revisions.
const spaceSchema = z.looseObject({
	schedule: services,
	exceptions: exceptions.optional(),
	breakSchedule: z.record(text, reference).optional(),
})

export interface ScheduleData {
	calendar: BreakCalendar<unknown>
	spaces: AuthoredSpace<unknown>[]
}

/** Check the normalized publication boundary without repeating authoring validation. */
export function parseScheduleData(calendarInput: unknown, spacesInput: unknown): ScheduleData {
	let calendar = calendarSchema.parse(calendarInput)
	let spaces = z.array(spaceSchema).parse(spacesInput)
	return {calendar, spaces}
}
