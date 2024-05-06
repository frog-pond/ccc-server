import {z} from 'zod'

const EventConfig = z.object({
	startTime: z.boolean(),
	endTime: z.boolean(),
	subtitle: z.union([z.literal('location'), z.literal('description')]),
})

export const Event = z.object({
	dataSource: z.string(),
	startTime: z.string().datetime(),
	endTime: z.string().datetime(),
	title: z.string(),
	description: z.string(),
	isOngoing: z.boolean(),
	links: z.array(z.unknown()),
	config: EventConfig,
	metadata: z.optional(z.unknown()),
})
