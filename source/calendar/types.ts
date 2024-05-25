import {z} from 'zod'

const EventConfigSchema = z.object({
	startTime: z.boolean(),
	endTime: z.boolean(),
	subtitle: z.union([z.literal('location'), z.literal('description')]),
})

export const EventSchema = z.object({
	dataSource: z.string(),
	startTime: z.string().datetime(),
	endTime: z.string().datetime(),
	title: z.string(),
	description: z.string(),
	location: z.string().default(''),
	isOngoing: z.boolean(),
	links: z.array(z.unknown()),
	config: EventConfigSchema,
	metadata: z.optional(z.unknown()),
})
