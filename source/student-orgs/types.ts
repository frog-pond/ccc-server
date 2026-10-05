import {z} from 'zod'

export type ContactPersonType = z.infer<typeof ContactPersonSchema>
export const ContactPersonSchema = z.object({
	lastName: z.string(),
	firstName: z.string(),
	title: z.string(),
	email: z.email(),
})

export type AdvisorType = z.infer<typeof AdvisorSchema>
export const AdvisorSchema = z.object({
	name: z.string(),
	email: z.email(),
})

export type StudentOrgType = z.infer<typeof StudentOrgSchema>
export const StudentOrgSchema = z.object({
	meetings: z.string(),
	contacts: ContactPersonSchema.array(),
	advisors: AdvisorSchema.array(),
	description: z.string(),
	category: z.string(),
	lastUpdated: z.string(),
	website: z.string().optional().nullable(),
	name: z.string().min(1),
	/** Presence's stable slug for the org, e.g. `"bird-alliance-3"` — not derivable
	 * from `name`, so it's the only reliable key for matching an org to its
	 * category memberships from the `/orgs/categories` route. */
	organizationUri: z.string(),
	/** Current member count, as Presence reports it. */
	memberCount: z.number(),
	/** `meetings` is these two joined, for builds that read only that. */
	meetingLocation: z.string(),
	meetingTime: z.string(),
	/** Every category the org is in; `category` is these joined. */
	categories: z.string().array(),
	hasCoverImage: z.boolean(),
	/** The cover image's file name on Presence's CDN, e.g. `"d73f….png"`. */
	photoUri: z.string(),
	/** `photoUri` with a `?v=` cache-buster that changes with the image. */
	photoUriWithVersion: z.string(),
	/** The cover image's address on Presence's CDN, or '' for an org without one. */
	photoUrl: z.union([z.url(), z.literal('')]),
	hasUpcomingEvents: z.boolean(),
})

export type SortableStudentOrgType = z.infer<typeof SortableStudentOrgSchema>
export const SortableStudentOrgSchema = StudentOrgSchema.extend({
	$sortableName: z.string(),
	$groupableName: z.string(),
})

/** One org with what only its own Presence pages hold, for its detail screen. */
export type DetailedStudentOrgType = z.infer<typeof DetailedStudentOrgSchema>
export const DetailedStudentOrgSchema = SortableStudentOrgSchema.extend({
	/** Instagram profiles, as URLs. */
	socialLinks: z.url().array(),
	constitutionUrl: z.union([z.url(), z.literal('')]),
	officeHours: z.string(),
	officeLocation: z.string(),
	/** Markdown, as `description` is here. */
	additionalInformation: z.string(),
})

/** One of Presence's org categories, with every org uri that belongs to it. */
export type OrgCategoryType = z.infer<typeof OrgCategorySchema>
export const OrgCategorySchema = z.object({
	/** Presence's stable id for the category, e.g. `"PBnP"`. */
	catIdh: z.string(),
	name: z.string(),
	organizationUris: z.string().array(),
})
