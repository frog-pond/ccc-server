import {z} from 'zod'

export type FeedItemType = z.infer<typeof FeedItemSchema>
export const FeedItemSchema = z.object({
	authors: z.string().array(),
	categories: z.string().array(),
	content: z.string(),
	datePublished: z.string().datetime().nullable(),
	excerpt: z.string().nullable(),
	featuredImage: z.string().url().nullable(),
	link: z.string().url().nullable(),
	title: z.string(),
})
