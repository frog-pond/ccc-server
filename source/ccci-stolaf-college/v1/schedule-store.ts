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

export interface SnapshotRead {
	responses: ScheduleResponses
	freshness: 'fresh' | 'stale'
	freshUntil: number
	source: 'hit' | 'refresh'
}

/** Scheduling policy only: load must return a completely validated response pair. */
export function createScheduleStore({
	load,
	now,
	onFallback,
}: {
	load: () => Promise<ScheduleResponses>
	now: () => number
	onFallback?: (error: unknown) => void
}) {
	let state: StoreState = {}

	function available(current: StoreState, source: SnapshotRead['source']): SnapshotRead {
		let time = now()
		let snapshot = current.lastGood
		if (!snapshot || snapshot.retainUntil <= time) {
			throw current.failure?.error ?? new Error('Schedule snapshot retention expired')
		}
		return {
			responses: snapshot.responses,
			freshness: snapshot.freshUntil > time ? 'fresh' : 'stale',
			freshUntil: snapshot.freshUntil,
			source,
		}
	}

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
			onFallback?.(failure)
		}
	}

	return {
		async read(): Promise<SnapshotRead> {
			// Capture the generation: clear() detaches every reader and refresh already in flight.
			let current = state
			let time = now()
			if (current.lastGood && current.lastGood.freshUntil > time) return available(current, 'hit')
			if (current.failure && current.failure.retryAt > time) return available(current, 'hit')
			if (!current.pending) {
				let pending = refresh(current).finally(() => {
					if (current.pending === pending) delete current.pending
				})
				current.pending = pending
			}
			await current.pending
			return available(current, 'refresh')
		},
		clear(): void {
			state = {}
		},
		get hasEntry(): boolean {
			return (
				state.lastGood !== undefined || state.failure !== undefined || state.pending !== undefined
			)
		},
		expiresIn(): number {
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
