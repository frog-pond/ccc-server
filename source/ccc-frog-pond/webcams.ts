import {z} from 'zod'
import {ColorSchema} from './color.js'

export const WebcamSchema = z.object({
	name: z.string(),
	pageUrl: z.string().url(),
	streamUrl: z.string().url(),
	thumbnail: z.string(),
	tagline: z.string(),
	accentColor: ColorSchema,
	textColor: ColorSchema,
})

export const WebcamResponseSchema = z.object({
	data: WebcamSchema.array(),
})
