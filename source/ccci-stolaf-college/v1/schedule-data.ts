import {z} from 'zod'
import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {resolveScheduleResponses} from '../../schedules/resolve.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'
import type {CacheAdmin} from '../../ccc-server/helpers.ts'

const envelope = z.object({data: z.unknown()})

/** Unwrap published JSON; the paired schedule parser validates the payload. */
async function getScheduleData(filename: 'building-hours.json' | 'breaks.json') {
	return envelope.parse(await getJson(GH_PAGES(filename))).data
}

interface Snapshot {
	responses: ReturnType<typeof resolveScheduleResponses>
	stale: boolean
}

interface SnapshotSlot {
	snapshot: Snapshot
	expiresAt: number
}

interface SnapshotCache {
	current?: SnapshotSlot
	lastGood?: SnapshotSlot
	failure?: {error: unknown; retryAt: number}
	pending?: Promise<Snapshot>
}

// Scope snapshots to a server instance, rather than independently to route URLs.
const caches = new WeakMap<Context['app'], SnapshotCache>()

/** Expose the shared pair under both route keys, including the combined-server prefix. */
export function scheduleCacheAdmin(ctx: Pick<Context, 'app' | 'path'>): CacheAdmin {
	let prefix = ctx.path.replace(/\/_cache\/?$/iu, '')
	let keys = [`${prefix}/v1/spaces/hours`, `${prefix}/v1/breaks`]
	return {
		*keys() {
			if (caches.has(ctx.app)) yield* keys
		},
		expiresIn(key) {
			if (!keys.includes(key)) return undefined
			let cache = caches.get(ctx.app)
			if (!cache) return undefined
			let expiresAt = cache.current?.expiresAt ?? cache.failure?.retryAt ?? Date.now()
			return Math.max(0, expiresAt - Date.now())
		},
		delete(key) {
			// Either endpoint invalidates the complete pair so their versions stay matched.
			return keys.includes(key) && caches.delete(ctx.app)
		},
		clear() {
			// Detach in-flight refreshes too; they must not repopulate an evicted cache.
			caches.delete(ctx.app)
		},
		get size() {
			return caches.has(ctx.app) ? keys.length : 0
		},
	}
}

async function refresh(cache: SnapshotCache): Promise<Snapshot> {
	try {
		let [hours, calendar] = await Promise.all([
			getScheduleData('building-hours.json'),
			getScheduleData('breaks.json'),
		])
		let responses = resolveScheduleResponses(calendar, hours)
		let snapshot = {responses, stale: false}
		let now = Date.now()
		cache.lastGood = {snapshot, expiresAt: now + ONE_DAY}
		cache.current = {snapshot, expiresAt: now + ONE_HOUR}
		delete cache.failure
		return snapshot
	} catch (error) {
		let now = Date.now()
		cache.failure = {error, retryAt: now + ONE_MINUTE}
		let previous = cache.lastGood
		if (!previous || previous.expiresAt <= now) {
			delete cache.lastGood
			delete cache.current
			throw error
		}
		let snapshot = {...previous.snapshot, stale: true}
		// Retry each minute without extending the last-good snapshot's retention.
		cache.current = {
			snapshot,
			expiresAt: Math.min(cache.failure.retryAt, previous.expiresAt),
		}
		console.warn('Schedule refresh failed; serving the last validated snapshot', error)
		return snapshot
	}
}

/** Refresh the pair atomically; retain last-good data for up to a day, retrying each minute. */
export async function getScheduleSnapshot(ctx: Context) {
	let cache = caches.get(ctx.app)
	if (!cache) {
		cache = {}
		caches.set(ctx.app, cache)
	}
	let current = cache.current
	let hit = current !== undefined && current.expiresAt > Date.now()
	let snapshot: Snapshot
	if (current && hit) {
		snapshot = current.snapshot
	} else {
		// Throttle failures even at boot, or after the last-good snapshot expires.
		if (cache.failure && cache.failure.retryAt > Date.now()) throw cache.failure.error
		cache.pending ??= refresh(cache)
		try {
			snapshot = await cache.pending
		} finally {
			delete cache.pending
		}
	}
	if (snapshot.stale) {
		ctx.cacheControl(false)
		ctx.set('X-Cached-Response', 'STALE')
	} else {
		// Both responses expire with their shared snapshot, even when requested at different times.
		let remaining = Math.max(0, (cache.current?.expiresAt ?? 0) - Date.now())
		ctx.cacheControl(Math.floor(remaining / 1000) * 1000)
		if (hit) ctx.set('X-Cached-Response', 'HIT')
	}
	return snapshot.responses
}
