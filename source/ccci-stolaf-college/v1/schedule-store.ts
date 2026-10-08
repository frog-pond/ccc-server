import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import type {resolveScheduleResponses} from '../../schedules/resolve.ts'

export type ScheduleResponses = ReturnType<typeof resolveScheduleResponses>

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
			let time = now()
			let fresh = current.lastGood !== undefined && current.lastGood.freshUntil > time
			let throttled = current.failure !== undefined && current.failure.retryAt > time
			let hit = fresh || throttled
			if (!hit) {
				current.pending ??= refresh(current).finally(() => {
					delete current.pending
				})
				await current.pending
			}
			let snapshot = current.lastGood
			time = now()
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
			if (!state.lastGood && !state.failure && !state.pending) return undefined
			let time = now()
			let snapshot = state.lastGood
			if (snapshot && snapshot.freshUntil > time) return snapshot.freshUntil - time
			let retryAt = state.failure?.retryAt ?? time
			let deadline =
				snapshot && snapshot.retainUntil > time ? Math.min(retryAt, snapshot.retainUntil) : retryAt
			return Math.max(0, deadline - time)
		},
	}
}
