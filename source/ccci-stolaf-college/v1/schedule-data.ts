import {z} from 'zod'
import QuickLRU from 'quick-lru'
import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {resolveScheduleResponses} from '../../schedules/resolve.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

const envelope = z.object({data: z.unknown()})

/** Unwrap published JSON; the paired schedule parser validates the payload. */
async function getScheduleData(filename: 'building-hours.json' | 'breaks.json') {
	return envelope.parse(await getJson(GH_PAGES(filename))).data
}

interface Snapshot {
	responses: ReturnType<typeof resolveScheduleResponses>
	stale: boolean
}

interface SnapshotCache {
	values: QuickLRU<'current' | 'last-good', Snapshot>
	pending?: Promise<Snapshot>
}

// Scope snapshots to a server instance, rather than independently to route URLs.
const caches = new WeakMap<Context['app'], SnapshotCache>()

async function refresh(cache: SnapshotCache): Promise<Snapshot> {
	try {
		let [hours, calendar] = await Promise.all([
			getScheduleData('building-hours.json'),
			getScheduleData('breaks.json'),
		])
		let responses = resolveScheduleResponses(calendar, hours)
		let snapshot = {responses, stale: false}
		cache.values.set('last-good', snapshot, {maxAge: ONE_DAY})
		cache.values.set('current', snapshot, {maxAge: ONE_HOUR})
		return snapshot
	} catch (error) {
		let previous = cache.values.get('last-good')
		if (!previous) throw error
		let snapshot = {...previous, stale: true}
		// Throttle failed refreshes without extending the last-good snapshot's retention.
		let remaining = cache.values.expiresIn('last-good') ?? 0
		cache.values.set('current', snapshot, {maxAge: Math.min(ONE_MINUTE, remaining)})
		console.warn('Schedule refresh failed; serving the last validated snapshot', error)
		return snapshot
	}
}

/** Refresh the pair atomically; retain last-good data for up to a day, retrying each minute. */
export async function getScheduleSnapshot(ctx: Context) {
	let cache = caches.get(ctx.app)
	if (!cache) {
		cache = {values: new QuickLRU({maxSize: 2})}
		caches.set(ctx.app, cache)
	}
	let snapshot = cache.values.get('current')
	let hit = snapshot !== undefined
	if (!hit) {
		cache.pending ??= refresh(cache)
		try {
			snapshot = await cache.pending
		} finally {
			delete cache.pending
		}
	}
	if (!snapshot) throw new Error('No validated schedule snapshot')
	if (snapshot.stale) {
		ctx.cacheControl(false)
		ctx.set('X-Cached-Response', 'STALE')
	} else {
		// Both responses expire with their shared snapshot, even when requested at different times.
		let remaining = Math.max(0, cache.values.expiresIn('current') ?? 0)
		ctx.cacheControl(Math.floor(remaining / 1000) * 1000)
		if (hit) ctx.set('X-Cached-Response', 'HIT')
	}
	return snapshot.responses
}
