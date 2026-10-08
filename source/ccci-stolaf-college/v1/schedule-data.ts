import {z} from 'zod'
import {getJson} from '../../ccc-lib/http.ts'
import {resolveScheduleResponses} from '../../schedules/resolve.ts'
import {createScheduleStore} from './schedule-store.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'
import type {CacheAdmin} from '../../ccc-server/helpers.ts'

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
