import {z} from 'zod'

export type AllAboutOlafExtraAzResponseType = z.infer<typeof AllAboutOlafExtraAzResponseSchema>
export const AllAboutOlafExtraAzResponseSchema = z.object({
	data: z.array(
		z.object({
			letter: z.string(),
			values: z.array(z.object({label: z.string(), url: z.string().url()})),
		}),
	),
})
