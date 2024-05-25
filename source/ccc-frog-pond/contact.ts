import {z} from 'zod'

export const ContactSchema = z.object({
	title: z.string(),
	phoneNumber: z.string(),
	buttonText: z.string(),
	category: z.string(),
	image: z.string().optional(),
	synopsis: z.string(),
	text: z.string(),
})

export const ContactResponseSchema = z.object({
	data: ContactSchema.array(),
})
