import {get, http} from '../ccc-lib/http.js'
import lodash from 'lodash'
import {JSDOM} from 'jsdom'
import pMap from 'p-map'
import {z} from 'zod'
import {SortableStudentOrgSchema, type SortableStudentOrgType} from './types.js'

const BasicPresenceOrgSchema = z.object({
	subdomain: z.string(),
	campusName: z.string(),
	name: z.string(),
	uri: z.string(),
	regularMeetingTime: z.string(),
	regularMeetingLocation: z.string(),
	hasCoverImage: z.boolean(),
	photoUri: z.string(),
	photoUriWithVersion: z.string(),
	photoType: z.union([z.literal('upload'), z.string()]),
	memberCount: z.number(),
	categories: z.string().array(),
	newOrg: z.boolean(),
	hasUpcomingEvents: z.boolean(),
})

type DetailedPresenceOrgType = z.infer<typeof DetailedPresenceOrgSchema>
const DetailedPresenceOrgSchema = BasicPresenceOrgSchema.and(
	z.object({
		description: z.string(),
		website: z.string().optional(),
	}),
)

export function cleanOrg(org: DetailedPresenceOrgType, sortableRegex: RegExp) {
	let name = org.name.trim()
	let category = org.categories.join(', ')
	let meetings =
		(org.regularMeetingLocation || '').trim() +
		(org.regularMeetingTime || '').trim()
	let description = JSDOM.fragment(org.description).textContent?.trim() ?? ''
	let website = org.website?.trim() ?? ''
	if (website && !/^https?:\/\//.test(website)) {
		website = `http://${website}`
	}

	let sortableName = name.replace(sortableRegex, '').toLowerCase()
	return SortableStudentOrgSchema.parse({
		advisors: [],
		category,
		contacts: [],
		description,
		lastUpdated: '2000-01-01',
		meetings,
		name,
		website,
		$sortableName: sortableName,
		$groupableName: sortableName.at(0)?.toLocaleUpperCase(),
	})
}

const fetchOrg = async (base: string, orgUri: string) =>
	DetailedPresenceOrgSchema.parse(await get(`${base}/${orgUri}`).json())

export async function presence(
	school: string,
): Promise<SortableStudentOrgType[]> {
	let orgsUrl = `https://api.presence.io/${school}/v1/organizations`

	let body = BasicPresenceOrgSchema.array().parse(
		await http.get(orgsUrl).json(),
	)

	let orgs = await pMap(body, (org) => fetchOrg(orgsUrl, org.uri), {
		concurrency: 8,
	})

	let sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

	let cleaned = orgs.map((org) => cleanOrg(org, sortableRegex))

	return lodash.sortBy(cleaned, '$sortableName')
}
