import {getJson} from '../ccc-lib/http.ts'
import {deburr, groupBy, sortBy, toPairs} from 'lodash-es'
import {JSDOM} from 'jsdom'
import pMap from 'p-map'
import {z} from 'zod'
import {
	OrgCategorySchema,
	SortableStudentOrgSchema,
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
})

type DetailedPresenceOrgType = z.infer<typeof DetailedPresenceOrgSchema>
const DetailedPresenceOrgSchema = BasicPresenceOrgSchema.and(
	z.object({
		description: z.string().default(''),
		website: z.string().optional().nullable(),
	}),
)

/**
 * The key an org sorts and groups by: its name folded to plain lower-case
 * letters, without the article or campus name a reader ignores, and without
 * the punctuation some orgs open with — `¡Presente!` belongs under P.
 */
export function sortableName(name: string, ignoredPrefixes: RegExp): string {
	return deburr(name)
		.replace(ignoredPrefixes, '')
		.replace(/^[^\p{Letter}\p{Number}]+/u, '')
		.toLowerCase()
}

/**
 * The section an org files under. Names that start with a digit, and names
 * left with nothing to file under, share the number sign, which iOS lists
 * after the letters.
 */
export function groupableName(sortableName: string): string {
	let first = sortableName.at(0)
	return first && /\p{Letter}/u.test(first) ? first.toLocaleUpperCase() : '#'
}

/** Orgs in list order: A through Z, then the number sign, the way iOS sorts an indexed list. */
export function sortOrgs<T extends {$groupableName: string; $sortableName: string}>(
	orgs: T[],
): T[] {
	return sortBy(orgs, [(org) => (org.$groupableName === '#' ? 1 : 0), '$sortableName'])
}

export function cleanOrg(org: DetailedPresenceOrgType, sortableRegex: RegExp) {
	let name = org.name.trim()
	let category = org.categories.join(', ')
	let meetings = (org.regularMeetingLocation ?? '').trim() + (org.regularMeetingTime ?? '').trim()
	let description = JSDOM.fragment(org.description).textContent.trim()
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
		lastUpdated: '2000-01-01',
		meetings,
		name,
		website,
		organizationUri: org.uri,
		memberCount: org.memberCount,
		$sortableName: sortable,
		$groupableName: groupableName(sortable),
	})
}

const fetchOrg = async (base: string, orgUri: string) =>
	DetailedPresenceOrgSchema.parse(await getJson(`${base}/${orgUri}`))

export async function presence(school: string): Promise<SortableStudentOrgType[]> {
	let orgsUrl = `https://api.presence.io/${school}/v1/organizations`

	let body = BasicPresenceOrgSchema.array().parse(await getJson(orgsUrl))

	let orgs = await pMap(body, (org) => fetchOrg(orgsUrl, org.uri), {
		concurrency: 8,
	})

	let sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

	let cleaned = orgs.map((org) => cleanOrg(org, sortableRegex))

	return sortOrgs(cleaned)
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

export async function presenceCategories(school: string): Promise<OrgCategoryType[]> {
	let categoriesUrl = `https://api.presence.io/${school}/v1/organizations/categories`

	let memberships = PresenceCategoryMembershipSchema.array().parse(await getJson(categoriesUrl))

	return groupCategories(memberships)
}
