import type {Context} from '../../ccc-server/context.ts'
import type {CacheAdmin} from '../../ccc-server/helpers.ts'
import {scheduleStoreFor} from './schedule-data.ts'

/** Expose the shared pair under both route keys, including the combined-server prefix. */
export function scheduleCacheAdmin(ctx: Pick<Context, 'app' | 'path'>): CacheAdmin {
	let store = scheduleStoreFor(ctx.app)
	let prefix = ctx.path.replace(/\/_cache\/?$/iu, '')
	let keys = [`${prefix}/v1/spaces/hours`, `${prefix}/v1/breaks`]
	return {
		*keys() {
			if (store.hasEntry) yield* keys
		},
		expiresIn(key) {
			if (!keys.includes(key)) return undefined
			return store.hasEntry ? store.expiresIn() : undefined
		},
		delete(key) {
			// Both endpoint keys identify the same store.
			if (!keys.includes(key) || !store.hasEntry) return 0
			store.clear()
			return keys.length
		},
		clear() {
			// Detach in-flight refreshes too; they must not repopulate an evicted cache.
			store.clear()
		},
		get size() {
			return store.hasEntry ? keys.length : 0
		},
	}
}
