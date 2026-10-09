import {z} from 'zod'

const EventConfigSchema = z.object({
	startTime: z.boolean(),
	endTime: z.boolean(),
	subtitle: z.union([z.literal('location'), z.literal('description')]),
})

export const EventSchema = z.object({
	dataSource: z.string(),
	startTime: z.iso.datetime(),
	endTime: z.iso.datetime(),
	title: z.string(),
	description: z.string(),
	location: z.string().default(''),
	isOngoing: z.boolean(),
	links: z.array(z.unknown()),
	config: EventConfigSchema,
	/// The event's picture, where its source has one. Absent, never empty.
	image: z.optional(z.url()),
	metadata: z.optional(z.unknown()),
})

export type EventType = z.infer<typeof EventSchema>
