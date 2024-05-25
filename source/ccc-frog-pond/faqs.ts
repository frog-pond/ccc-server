import {z} from 'zod'

export const FaqsSchema = z.object({
	text: z.string(),
})
