import {presence, presenceCategories} from '../../student-orgs/presence.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function orgs(c: Context) {
	return c.json(await presence('stolaf'))
}

/// Lighter than `/orgs`: one row per category, with the org uris in it, so a
/// client can show category tiles without fetching all 225 full org records.
export async function orgCategories(c: Context) {
	return c.json(await presenceCategories('stolaf'))
}
