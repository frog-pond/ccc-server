import {z} from 'zod'
import type {BreakCalendar, Schedule, Space} from './types.ts'
import {validateSchedules} from './validate.ts'

const text = z.string().regex(/\S/u)
const date = z.iso.date()
const time = z.string().regex(/^(?:[1-9]|1[0-2]):[0-5]\d[ap]m$/u)
// Retain additive upstream metadata while validating every known scheduling field.
const hoursRow = z.looseObject({
	days: z
		.array(z.enum(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']))
		.min(1)
		.refine((days) => new Set(days).size === days.length, 'duplicate weekdays'),
	from: time,
	to: time,
})
const service = z
	.looseObject({
		title: text,
		notes: text.optional(),
		isPhysicallyOpen: z.boolean().optional(),
		closedForChapelTime: z.boolean().optional(),
		hours: z.array(hoursRow),
	})
	.refine(
		(block) =>
			block.hours.length > 0 || block.isPhysicallyOpen === false || block.notes !== undefined,
		'empty hours require an explicit closure or explanatory notes',
	)

export type ServiceBlock = z.infer<typeof service>
const services = z.array(service).min(1)
const exceptions = z.array(z.looseObject({date, schedule: services}))
const policy = z.union([
	services.transform((schedule) => ({schedule, exceptions: []})),
	z.looseObject({schedule: services, exceptions: exceptions.default([])}),
])
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
	name: text,
	category: z.string(),
	kind: z.enum(['building', 'office', 'space', 'service']),
	schedule: services,
	exceptions: exceptions.optional(),
	breakSchedule: z.record(text, reference).optional(),
})

export interface ScheduleData {
	calendar: BreakCalendar<ServiceBlock>
	spaces: Space<ServiceBlock, string | Schedule<ServiceBlock>>[]
}

/** Parse JSON payloads, normalize shorthand, then validate the entire reference graph. */
export function parseScheduleData(calendarInput: unknown, spacesInput: unknown): ScheduleData {
	let calendar = calendarSchema.parse(calendarInput)
	let spaces = z.array(spaceSchema).parse(spacesInput)
	validateSchedules(
		calendar,
		spaces.map((schedules, index) => ({label: `spaces[${index.toFixed(0)}]`, schedules})),
	)
	return {calendar, spaces}
}
