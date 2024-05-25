import {z} from 'zod'
import {DayOfWeekSchema} from './day-of-week.js'
import {AmPmTimeSchema} from './time.js'

const LinkSchema = z.object({
	title: z.string(),
	url: z.string().url(),
})

const ScheduleBlockSchema = z.object({
	days: DayOfWeekSchema.array(),
	from: AmPmTimeSchema,
	to: AmPmTimeSchema,
})

const ScheduleSchema = z.object({
	title: z.string(),
	notes: z.string().optional(),
	closedForChapelTime: z.boolean().optional(),
	isPhysicallyOpen: z.boolean().optional(),
	hours: ScheduleBlockSchema.array(),
})

export const BuildingHoursSchema = z.object({
	name: z.string(),
	subtitle: z.string().optional(),
	abbreviation: z.string().optional(),
	category: z.string(),
	image: z.string().optional(),
	isNotice: z.boolean().optional(),
	noticeMessage: z.string().optional(),
	schedule: ScheduleSchema.array(),
	links: LinkSchema.array().optional(),
})

export const BuildingHoursResponseSchema = z.object({
	data: BuildingHoursSchema.array(),
})
