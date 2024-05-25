import {z} from 'zod'

export const DictionarySchema = z.object({
	word: z.string(),
	definition: z.string(),
})

export const DictionaryResponseSchema = z.object({
	data: DictionarySchema.array(),
})
