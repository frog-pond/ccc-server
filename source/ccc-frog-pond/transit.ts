import {z} from 'zod'
import {ColorSchema} from './color.js'
import {DayOfWeekSchema} from './day-of-week.js'

const CoordinateSchema = z.tuple([z.number(), z.number()])

const BusScheduleSchema = z.object({
	days: DayOfWeekSchema.array(),
	coordinates: z.record(z.string(), CoordinateSchema),
	stops: z.array(z.string()),
	times: z.array(z.array(z.string())),
})

const BusTimesSchema = z.object({
	line: z.string(),
	colors: z.object({bar: ColorSchema, dot: ColorSchema}),
	notice: z.string().optional(),
	schedules: BusScheduleSchema.array(),
})

export const BusTimesResponseSchema = z.object({
	data: BusTimesSchema.array(),
})

export const TransitModeSchema = z.object({
	name: z.string(),
	category: z.string(),
	url: z.string().url(),
	synopsis: z.string(),
	description: z.string(),
})

export const TransitModesResponseSchema = z.object({
	data: TransitModeSchema.array(),
})
