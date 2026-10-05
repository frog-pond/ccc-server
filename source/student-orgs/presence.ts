import {getJson, http} from '../ccc-lib/http.ts'
import {
	advisorsOf,
	contactsOf,
	instagramLinks,
	markdownOf,
	portalFields,
	urlOrBlank,
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

const BasicPresenceOrgSchema = z.object({
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
type PresenceOrgType = z.infer<typeof BasicPresenceOrgSchema>

/// Presence publishes no date an org was last edited -- not in the list, an
/// org's record, its portal view, or a Last-Modified header. Current builds
/// never show the field, but AAO 2.7's detail screen prints it as "Last
/// updated", parsed with moment's `MMMM, DD YYYY HH:mm:ss`: this stand-in
/// reads there as 01/20/2000, where an empty string would read "Invalid
/// date". So it stays, and stays a string, as every shipped build types it.
const NO_LAST_UPDATED_DATE = '2000-01-01'

/// The campus Presence serves: where its files are, and the id it files them under.
const PresenceCampusSchema = z.object({apiId: z.string(), cdn: z.url()})
export type PresenceCampusType = z.infer<typeof PresenceCampusSchema>

const fetchCampus = async (base: string) =>
	PresenceCampusSchema.parse(await getJson(`${base}/app/campus`))

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

const SORTABLE_PREFIXES = /^(St\.? Olaf(?: College)?|The) +/i

/// Every org, from Presence's list alone. Each org's own record adds nothing
/// the list lacks -- the same description, as HTML, and the same meeting
/// fields -- so the list is one request rather than one per org; what only
/// an org's own pages hold is `presenceOrg`'s job, one org at a time.
export async function presence(school: string): Promise<SortableStudentOrgType[]> {
	let base = `https://api.presence.io/${school}/v1`

	let [list, campus] = await Promise.all([getJson(`${base}/organizations`), fetchCampus(base)])
	let body = BasicPresenceOrgSchema.array().parse(list)

	return sortOrgs(body.map((org) => cleanOrg(org, SORTABLE_PREFIXES, campus)))
}

/// One row per org-category membership — an org with two categories appears
/// twice. `/organizations/categories` returns this flat, so a category tile
/// with its org count means grouping it ourselves.
const PresenceCategoryMembershipSchema = z.object({
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

export async function presenceCategories(school: string): Promise<OrgCategoryType[]> {
	let categoriesUrl = `https://api.presence.io/${school}/v1/organizations/categories`

	let memberships = PresenceCategoryMembershipSchema.array().parse(await getJson(categoriesUrl))

	return groupCategories(memberships)
}

/// One org with what only its own Presence pages hold: contacts, advisors,
/// social links and the like, from its portal view, which is too heavy to
/// read for every org at once. The rest comes from the list, as `/orgs` has
/// it -- an org's own record lacks `hasUpcomingEvents` -- so the two never
/// disagree. Undefined when Presence lists no such org.
export async function presenceOrg(
	school: string,
	uri: string,
): Promise<DetailedStudentOrgType | undefined> {
	let base = `https://api.presence.io/${school}/v1`
	let [list, campus, portal] = await Promise.all([
		getJson(`${base}/organizations`),
		fetchCampus(base),
		http.get(`${base}/grid/portal-view/Organization/${uri}/`),
	])

	let listed = BasicPresenceOrgSchema.array()
		.parse(list)
		.find((org) => org.uri === uri)
	if (!listed) {
		return undefined
	}

	return orgDetail(cleanOrg(listed, SORTABLE_PREFIXES, campus), portalFields(await portal.json()))
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
