import {getText} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'
import {unavailableOrgs} from './deprecated.ts'
import {CARLETON_ORGS_URL, orgsFromHtml, type SortableCarletonStudentOrgType} from './orgs-shape.ts'

export {
	CarletonStudentOrgSchema,
	SortableCarletonStudentOrgSchema,
	domToOrg,
	type CarletonStudentOrgType,
	type SortableCarletonStudentOrgType,
} from './orgs-shape.ts'

/// Kept against the block being lifted: the page's shape has not changed,
/// only our ability to reach it.
export async function getOrgs(): Promise<SortableCarletonStudentOrgType[]> {
	return orgsFromHtml(await getText(CARLETON_ORGS_URL))
}

export function orgs(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)
	if (ctx.cached(ONE_HOUR * 6)) return

	ctx.body = unavailableOrgs()
}
