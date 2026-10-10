import {getJson} from '../ccc-lib/http.ts'
import {portalFields} from './portal.ts'
import {
	BasicPresenceOrgSchema,
	PresenceCampusSchema,
	SORTABLE_PREFIXES,
	cleanOrg,
	orgDetail,
	presenceCategories as categoriesOf,
	presenceOrgs,
	presencePortalUrl,
	presenceUrls,
} from './presence-shape.ts'
import type {DetailedStudentOrgType, OrgCategoryType, SortableStudentOrgType} from './types.ts'

export {
	cleanOrg,
	groupCategories,
	orgDetail,
	withoutDemoCategory,
	withoutDemoOrgs,
	type PresenceCampusType,
} from './presence-shape.ts'

const fetchCampus = async (school: string) =>
	PresenceCampusSchema.parse(await getJson(presenceUrls(school).campus))

/// Every org, from Presence's list alone. Each org's own record adds nothing
/// the list lacks -- the same description, as HTML, and the same meeting
/// fields -- so the list is one request rather than one per org; what only
/// an org's own pages hold is `presenceOrg`'s job, one org at a time.
export async function presence(school: string): Promise<SortableStudentOrgType[]> {
	let [list, campus] = await Promise.all([
		getJson(presenceUrls(school).organizations),
		fetchCampus(school),
	])
	return presenceOrgs(list, campus)
}

export async function presenceCategories(school: string): Promise<OrgCategoryType[]> {
	return categoriesOf(await getJson(presenceUrls(school).categories))
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
	let [list, campus, portal] = await Promise.all([
		getJson(presenceUrls(school).organizations),
		fetchCampus(school),
		getJson(presencePortalUrl(school, uri)),
	])

	let listed = BasicPresenceOrgSchema.array()
		.parse(list)
		.find((org) => org.uri === uri)
	if (!listed) {
		return undefined
	}

	return orgDetail(cleanOrg(listed, SORTABLE_PREFIXES, campus), portalFields(portal))
}
