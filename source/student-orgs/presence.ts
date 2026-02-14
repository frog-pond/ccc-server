import {getJson} from '../ccc-lib/http.ts'
import {sortBy} from 'lodash-es'
import {JSDOM} from 'jsdom'
import pMap from 'p-map'
import {z} from 'zod'
import {SortableStudentOrgSchema, type SortableStudentOrgType} from './types.ts'

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
		description: z.string().optional(),
		website: z.string().optional().nullable(),
	}),
)

export function cleanOrg(org: DetailedPresenceOrgType, sortableRegex: RegExp) {
	let name = org.name.trim()
	let category = org.categories.join(', ')
	let meetings = (org.regularMeetingLocation ?? '').trim() + (org.regularMeetingTime ?? '').trim()
	let description = JSDOM.fragment(org.description ?? '').textContent.trim()
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
	DetailedPresenceOrgSchema.parse(await getJson(`${base}/${orgUri}`))

export async function presence(school: string): Promise<SortableStudentOrgType[]> {
	let orgsUrl = `https://api.presence.io/${school}/v1/organizations`

	let body = BasicPresenceOrgSchema.array().parse(await getJson(orgsUrl))

	let orgs = await pMap(body, (org) => fetchOrg(orgsUrl, org.uri), {
		concurrency: 8,
	})

	let sortableRegex = /^(St\.? Olaf(?: College)?|The) +/i

	let cleaned = orgs.map((org) => cleanOrg(org, sortableRegex))

	return sortBy(cleaned, '$sortableName')
}
