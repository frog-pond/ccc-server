import {
	advisorsOf,
	contactsOf,
	instagramLinks,
	markdownOf,
	urlOrBlank,
	type portalFields,
} from './portal.ts'
import {groupableName, sortOrgs, sortableName} from './names.ts'
import {groupBy, sortBy, toPairs} from 'lodash-es'
import {textFromHtml} from '../ccc-lib/dom.ts'
import {z} from 'zod'
import {
	DetailedStudentOrgSchema,
	OrgCategorySchema,
	SortableStudentOrgSchema,
	type DetailedStudentOrgType,
	type OrgCategoryType,
	type SortableStudentOrgType,
} from './types.ts'

/// St. Olaf's student orgs as Presence publishes them, shaped for the app.
/// Nothing here fetches, so the Node server and the Cloudflare Worker share it.

/// Where a school's Presence API is.
export const presenceBase = (school: string) => `https://api.presence.io/${school}/v1`

/// The addresses an org list is made from: every org, the campus (for cover
/// images), and the category memberships.
export const presenceUrls = (school: string) => ({
	organizations: `${presenceBase(school)}/organizations`,
	campus: `${presenceBase(school)}/app/campus`,
	categories: `${presenceBase(school)}/organizations/categories`,
})

/// The portal view of one org, which holds its contacts and advisors.
export const presencePortalUrl = (school: string, uri: string) =>
	`${presenceBase(school)}/grid/portal-view/Organization/${encodeURIComponent(uri)}/`

export const BasicPresenceOrgSchema = z.object({
	subdomain: z.string(),
	campusName: z.string(),
	name: z.string(),
	uri: z.string(),
	regularMeetingTime: z.string().optional(),
	regularMeetingLocation: z.string().optional(),
	hasCoverImage: z.boolean(),
	photoUri: z.string(),
	photoUriWithVersion: z.string(),
	photoType: z
		.union([z.literal('default'), z.literal('search'), z.literal('upload'), z.literal('')])
		.optional()
		.nullable(),
	memberCount: z.number(),
	categories: z.string().array(),
	newOrg: z.boolean().optional(),
	hasUpcomingEvents: z.boolean().optional(),
	/** Plain text with HTML entities in the list; HTML in an org's own record. */
	description: z.string().default(''),
	website: z.string().optional().nullable(),
})
export type PresenceOrgType = z.infer<typeof BasicPresenceOrgSchema>

/// Presence publishes no date an org was last edited -- not in the list, an
/// org's record, its portal view, or a Last-Modified header. Current builds
/// never show the field, but AAO 2.7's detail screen prints it as "Last
/// updated", parsed with moment's `MMMM, DD YYYY HH:mm:ss`: this stand-in
/// reads there as 01/20/2000, where an empty string would read "Invalid
/// date". So it stays, and stays a string, as every shipped build types it.
const NO_LAST_UPDATED_DATE = '2000-01-01'

/// The campus Presence serves: where its files are, and the id it files them under.
export const PresenceCampusSchema = z.object({apiId: z.string(), cdn: z.url()})
export type PresenceCampusType = z.infer<typeof PresenceCampusSchema>

/// Where Presence's own site loads an org's cover image from, as the app does
/// for an event's: the campus CDN, then the campus id, then the image's
/// versioned name. Blank for an org with no cover, or with no campus to hand.
function photoUrl(org: PresenceOrgType, campus: PresenceCampusType | undefined): string {
	if (!campus || !org.hasCoverImage || !org.photoUriWithVersion) {
		return ''
	}
	let path = `/organization-photos/${campus.apiId}/${org.photoUriWithVersion}`
	return new URL(path, campus.cdn).toString()
}

export function cleanOrg(org: PresenceOrgType, sortableRegex: RegExp, campus?: PresenceCampusType) {
	let name = org.name.trim()
	let category = org.categories.join(', ')
	let meetingLocation = org.regularMeetingLocation?.trim() ?? ''
	let meetingTime = org.regularMeetingTime?.trim() ?? ''
	let meetings = [meetingLocation, meetingTime].filter(Boolean).join(', ')
	let description = textFromHtml(org.description)
	let website = org.website?.trim() ?? ''
	if (website && !/^https?:\/\//.test(website)) {
		website = `http://${website}`
	}

	let sortable = sortableName(name, sortableRegex)
	return SortableStudentOrgSchema.parse({
		advisors: [],
		category,
		contacts: [],
		description,
		lastUpdated: NO_LAST_UPDATED_DATE,
		meetings,
		meetingLocation,
		meetingTime,
		name,
		website,
		organizationUri: org.uri,
		memberCount: org.memberCount,
		categories: org.categories,
		hasCoverImage: org.hasCoverImage,
		photoUri: org.photoUri,
		photoUriWithVersion: org.photoUriWithVersion,
		photoUrl: photoUrl(org, campus),
		hasUpcomingEvents: org.hasUpcomingEvents ?? false,
		$sortableName: sortable,
		$groupableName: groupableName(sortable),
	})
}

export function withoutDemoOrgs(orgs: SortableStudentOrgType[]): SortableStudentOrgType[] {
	return orgs.filter((org) => !org.category.split(', ').includes('Demo'))
}

export const SORTABLE_PREFIXES = /^(St\.? Olaf(?: College)?|The) +/i

/// One row per org-category membership — an org with two categories appears
/// twice. `/organizations/categories` returns this flat, so a category tile
/// with its org count means grouping it ourselves.
export const PresenceCategoryMembershipSchema = z.object({
	catIdh: z.string(),
	name: z.string(),
	organizationUri: z.string(),
})
type PresenceCategoryMembershipType = z.infer<typeof PresenceCategoryMembershipSchema>

export function groupCategories(memberships: PresenceCategoryMembershipType[]): OrgCategoryType[] {
	let grouped = groupBy(memberships, (m) => m.catIdh)

	let categories = toPairs(grouped).map(([catIdh, rows]) =>
		OrgCategorySchema.parse({
			catIdh,
			name: rows.at(0)?.name ?? '',
			organizationUris: rows.map((row) => row.organizationUri),
		}),
	)

	return sortBy(categories, 'name')
}

export function withoutDemoCategory(categories: OrgCategoryType[]): OrgCategoryType[] {
	let demoOrgUris = new Set(
		categories
			.filter((category) => category.name === 'Demo')
			.flatMap((category) => category.organizationUris),
	)

	return categories
		.filter((category) => category.name !== 'Demo')
		.map((category) => ({
			...category,
			organizationUris: category.organizationUris.filter((uri) => !demoOrgUris.has(uri)),
		}))
}

/// An org from the list, with what its portal view adds. The description is
/// the portal's statement of purpose, as markdown, since the list runs its
/// paragraphs together; the list's plain text stands when the portal's is
/// blank, and reads as markdown too.
export function orgDetail(
	org: SortableStudentOrgType,
	fields: ReturnType<typeof portalFields>,
): DetailedStudentOrgType {
	return DetailedStudentOrgSchema.parse({
		...org,
		description: markdownOf(fields.statementOfPurpose) || org.description,
		contacts: contactsOf(fields),
		advisors: advisorsOf(fields),
		socialLinks: instagramLinks(fields.instagram),
		constitutionUrl: urlOrBlank(fields.constitution),
		officeHours: fields.officeHours,
		officeLocation: fields.officeLocation,
		additionalInformation: markdownOf(fields.additionalInformation),
	})
}

/// Every org in Presence's list, cleaned and in list order, from the list and
/// the campus as Presence answers them.
export function presenceOrgs(list: unknown, campus: unknown): SortableStudentOrgType[] {
	let parsedCampus = PresenceCampusSchema.parse(campus)
	return sortOrgs(
		BasicPresenceOrgSchema.array()
			.parse(list)
			.map((org) => cleanOrg(org, SORTABLE_PREFIXES, parsedCampus)),
	)
}

/// The categories, with their orgs, from the memberships as Presence answers them.
export function presenceCategories(memberships: unknown): OrgCategoryType[] {
	return groupCategories(PresenceCategoryMembershipSchema.array().parse(memberships))
}
