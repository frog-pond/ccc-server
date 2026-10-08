import {z} from 'zod'
import {getJson} from '../../ccc-lib/http.ts'
import {resolveScheduleResponses} from '../../schedules/resolve.ts'
import {createScheduleStore} from './schedule-store.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

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
export function scheduleStoreFor(app: object) {
	let store = stores.get(app)
	if (!store) {
		store = createScheduleStore({
			load: loadScheduleResponses,
			now: () => Date.now(),
			onFallback: (error) => {
				console.warn('Schedule refresh failed; serving the last validated snapshot', error)
			},
		})
		stores.set(app, store)
	}
	return store
}

/** Translate store freshness into HTTP policy without creating a URL-specific response cache. */
export async function getScheduleSnapshot(ctx: Context) {
	let snapshot = await scheduleStoreFor(ctx.app).read()
	if (snapshot.freshness === 'stale') {
		ctx.cacheControl(false)
		ctx.set('X-Cached-Response', 'STALE')
	} else {
		let remaining = Math.max(0, snapshot.freshUntil - Date.now())
		ctx.cacheControl(Math.floor(remaining / 1000) * 1000)
		if (snapshot.source === 'hit') ctx.set('X-Cached-Response', 'HIT')
	}
	return snapshot.responses
}
