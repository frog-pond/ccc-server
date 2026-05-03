import {z} from 'zod'

export type FeedItemType = z.infer<typeof FeedItemSchema>
export const FeedItemSchema = z.object({
	authors: z.string().array(),
	categories: z.string().array(),
	content: z.string(),
	datePublished: z.iso.datetime().nullable(),
	excerpt: z.string().nullable(),
	featuredImage: z.url().nullable(),
	link: z.url().nullable(),
	title: z.string(),
})
