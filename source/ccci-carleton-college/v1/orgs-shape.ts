import {z} from 'zod'

/// The shape of a Carleton student org, as the app reads it. Nothing here
/// fetches, so the Node server and the Cloudflare Worker share it.

/// An org with no website, or none we may administer, is ordinary rather than
/// malformed, and `domToOrg` says so with ''. Demanding a URL outright threw on
/// those, and `getOrgs` parses in an unguarded loop, so one such org emptied the
/// whole list.
const UrlOrBlank = z.union([z.url(), z.literal('')])

export type CarletonStudentOrgType = z.infer<typeof CarletonStudentOrgSchema>
export const CarletonStudentOrgSchema = z.object({
	id: z.string(),
	contacts: z.string().array(),
	categories: z.string().array(),
	socialLinks: z.url().array(),
	adminLink: UrlOrBlank,
	description: z.string(),
	website: UrlOrBlank,
	name: z.string().min(1),
})

export type SortableCarletonStudentOrgType = z.infer<typeof SortableCarletonStudentOrgSchema>
export const SortableCarletonStudentOrgSchema = CarletonStudentOrgSchema.extend({
	/** The name, folded for sorting: no leading prefix such as "The", no accents, no opening punctuation */
	$sortableName: z.string(),
	$groupableName: z.string(),
})
