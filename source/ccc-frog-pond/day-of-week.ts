import {z} from 'zod'

export const DayOfWeekSchema = z.union([
	z.literal('Mo'),
	z.literal('Tu'),
	z.literal('We'),
	z.literal('Th'),
	z.literal('Fr'),
	z.literal('Sa'),
	z.literal('Su'),
])
