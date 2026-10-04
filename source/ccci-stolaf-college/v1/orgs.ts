import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import {
	presence,
	presenceCategories,
	presenceOrg,
	withoutDemoCategory,
	withoutDemoOrgs,
} from '../../student-orgs/presence.ts'
import type {Context} from '../../ccc-server/context.ts'

const CACHE_DURATION = ONE_HOUR * 36

export async function orgs(ctx: Context) {
	ctx.cacheControl(CACHE_DURATION)
	if (ctx.cached(CACHE_DURATION)) return

	ctx.body = withoutDemoOrgs(await presence('stolaf'))
}

/// Lighter than `/orgs`: one row per category, with the org uris in it, so a
/// client can show category tiles without fetching all 225 full org records.
export async function orgCategories(ctx: Context) {
	ctx.cacheControl(CACHE_DURATION)
	if (ctx.cached(CACHE_DURATION)) return

	ctx.body = withoutDemoCategory(await presenceCategories('stolaf'))
}

/// Presence's slugs: lowercase words and digits joined by hyphens.
const ORG_URI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/// One org, with the contacts, advisors and links `/orgs` leaves out: they
/// come from a page of Presence's too heavy to read for every org at once, so
/// the app asks for them when someone opens an org.
export async function org(ctx: Context) {
	let {uri = ''} = ctx.params
	// Checked before the cache, so a made-up slug never takes a cache entry.
	ctx.assert(ORG_URI.test(uri), 404)

	ctx.cacheControl(CACHE_DURATION)
	if (ctx.cached(CACHE_DURATION)) return

	let detail = await presenceOrg('stolaf', uri)
	ctx.assert(detail, 404, `No student org has the uri ${uri}`)
	// A Demo org is as absent here as it is from `/orgs`.
	ctx.assert(withoutDemoOrgs([detail]).length, 404, `No student org has the uri ${uri}`)
	ctx.body = detail
}
