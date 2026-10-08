import {z} from 'zod'
import {getJson} from '../../ccc-lib/http.ts'
import {resolveScheduleResponses} from '../../schedules/resolve.ts'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'
import type {CacheAdmin} from '../../ccc-server/helpers.ts'

export type ScheduleResponses = ReturnType<typeof resolveScheduleResponses>

const envelope = z.object({data: z.unknown()})

/** Unwrap published JSON; the paired schedule parser validates the payload. */
async function getScheduleData(filename: 'building-hours.json' | 'breaks.json') {
	return envelope.parse(await getJson(GH_PAGES(filename))).data
}

async function loadScheduleResponses() {
	// These independent URLs have no shared upstream revision. Validate before publishing locally.
	let [hours, calendar] = await Promise.all([
		getScheduleData('building-hours.json'),
		getScheduleData('breaks.json'),
	])
	return resolveScheduleResponses(calendar, hours)
}

const stores = new WeakMap<object, ReturnType<typeof createScheduleStore>>()

/** One schedule store per server instance, shared by route and administration adapters. */
function scheduleStoreFor(app: object) {
	let store = stores.get(app)
	if (!store) {
		store = createScheduleStore({
			load: loadScheduleResponses,
			now: () => Date.now(),
		})
		stores.set(app, store)
	}
	return store
}

/** Translate store freshness into HTTP policy without creating a URL-specific response cache. */
export async function getScheduleSnapshot(ctx: Context) {
	let snapshot = await scheduleStoreFor(ctx.app).read()
	if (snapshot.status === 'STALE') {
		ctx.cacheControl(false)
		ctx.set('X-Cached-Response', 'STALE')
	} else {
		let remaining = Math.max(0, snapshot.freshUntil - Date.now())
		ctx.cacheControl(Math.floor(remaining / 1000) * 1000)
		if (snapshot.status === 'HIT') ctx.set('X-Cached-Response', 'HIT')
	}
	return snapshot.responses
}

/** Expose the shared pair under both route keys, including the combined-server prefix. */
export function scheduleCacheAdmin(ctx: Pick<Context, 'app' | 'path'>): CacheAdmin {
	let store = scheduleStoreFor(ctx.app)
	let prefix = ctx.path.replace(/\/_cache\/?$/iu, '')
	let keys = [`${prefix}/v1/spaces/hours`, `${prefix}/v1/breaks`]
	return {
		*keys() {
			if (store.expiresIn() !== undefined) yield* keys
		},
		expiresIn(key) {
			if (!keys.includes(key)) return undefined
			return store.expiresIn()
		},
		delete(key) {
			// Both endpoint keys identify the same store.
			if (!keys.includes(key) || store.expiresIn() === undefined) return 0
			store.clear()
			return keys.length
		},
		clear() {
			// Detach in-flight refreshes too; they must not repopulate an evicted cache.
			store.clear()
		},
		get size() {
			return store.expiresIn() !== undefined ? keys.length : 0
		},
	}
}

interface SuccessfulSnapshot {
	responses: ScheduleResponses
	freshUntil: number
	retainUntil: number
}

interface StoreState {
	lastGood?: SuccessfulSnapshot
	failure?: {error: Error; retryAt: number}
	pending?: Promise<void>
}

interface SnapshotRead {
	responses: ScheduleResponses
	status: 'HIT' | 'MISS' | 'STALE'
	freshUntil: number
}

/** Scheduling policy only: load must return a completely validated response pair. */
export function createScheduleStore({
	load,
	now,
}: {
	load: () => Promise<ScheduleResponses>
	now: () => number
}) {
	let state: StoreState = {}

	async function refresh(current: StoreState): Promise<void> {
		try {
			let responses = await load()
			let time = now()
			current.lastGood = {responses, freshUntil: time + ONE_HOUR, retainUntil: time + ONE_DAY}
			delete current.failure
		} catch (error) {
			let time = now()
			let failure =
				error instanceof Error ? error : new Error('Schedule refresh failed', {cause: error})
			current.failure = {error: failure, retryAt: time + ONE_MINUTE}
			if (!current.lastGood || current.lastGood.retainUntil <= time) {
				delete current.lastGood
				throw failure
			}
			console.warn('Schedule refresh failed; serving the last validated snapshot', failure)
		}
	}

	return {
		async read(): Promise<SnapshotRead> {
			// clear() replaces state; an old refresh can only update its detached state object.
			let current = state
			let refreshAt = current.failure?.retryAt ?? current.lastGood?.freshUntil
			let hit = refreshAt !== undefined && refreshAt > now()
			if (!hit) {
				current.pending ??= refresh(current).finally(() => {
					delete current.pending
				})
				await current.pending
			}
			let snapshot = current.lastGood
			let time = now()
			if (!snapshot || snapshot.retainUntil <= time) {
				throw current.failure?.error ?? new Error('Schedule snapshot retention expired')
			}
			return {
				responses: snapshot.responses,
				freshUntil: snapshot.freshUntil,
				status: snapshot.freshUntil <= time ? 'STALE' : hit ? 'HIT' : 'MISS',
			}
		},
		clear(): void {
			state = {}
		},
		/** Undefined means empty; zero means an existing entry is due for refresh. */
		expiresIn(): number | undefined {
			let refreshAt = state.failure?.retryAt ?? state.lastGood?.freshUntil
			if (refreshAt === undefined) return state.pending ? 0 : undefined
			let time = now()
			let retainUntil = state.lastGood?.retainUntil
			let deadline =
				retainUntil !== undefined && retainUntil > time
					? Math.min(refreshAt, retainUntil)
					: refreshAt
			return Math.max(0, deadline - time)
		},
	}
}
