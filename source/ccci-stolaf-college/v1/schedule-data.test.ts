import assert from 'node:assert/strict'
import {test} from 'node:test'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {createScheduleStore, type ScheduleResponses} from './schedule-data.ts'

function responses(name: string): ScheduleResponses {
	return {
		hours: {data: []},
		calendar: {data: {timezone: 'UTC', breaks: {holiday: {name, date: '2026-10-10'}}}},
	}
}

function harness() {
	let time = 0
	let calls = 0
	let next: ScheduleResponses | Error = responses('first')
	let store = createScheduleStore({
		load: () => {
			calls += 1
			return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
		},
		now: () => time,
	})
	return {
		store,
		setTime: (value: number) => {
			time = value
		},
		setNext: (value: ScheduleResponses | Error) => {
			next = value
		},
		calls: () => calls,
	}
}

void test('fresh reads share one response pair and a fixed deadline, refreshing at the boundary', async () => {
	let {store, setTime, setNext, calls} = harness()
	assert.equal(store.expiresIn(), undefined)
	let first = await store.read()
	assert.equal(first.status, 'MISS')
	assert.equal(first.freshUntil, ONE_HOUR)
	setTime(ONE_HOUR - 1)
	let hit = await store.read()
	assert.equal(hit.responses, first.responses)
	assert.equal(hit.status, 'HIT')
	assert.equal(hit.freshUntil, ONE_HOUR)
	assert.equal(store.expiresIn(), 1)
	assert.equal(calls(), 1)
	setTime(ONE_HOUR)
	let second = responses('second')
	setNext(second)
	assert.equal((await store.read()).responses, second)
	assert.equal(calls(), 2)
	assert.equal(store.expiresIn(), ONE_HOUR)
})

void test('cold failures share one attempt, throttle until the retry boundary, and recover', async () => {
	let {store, setTime, setNext, calls} = harness()
	let failure = new Error('upstream unavailable')
	setNext(failure)
	let reads = await Promise.allSettled([store.read(), store.read()])
	assert.deepEqual(reads, [
		{status: 'rejected', reason: failure},
		{status: 'rejected', reason: failure},
	])
	assert.equal(calls(), 1)
	assert.equal(store.expiresIn(), ONE_MINUTE)
	setNext(responses('recovered'))
	setTime(ONE_MINUTE - 1)
	await assert.rejects(store.read(), (error: unknown) => error === failure)
	assert.equal(calls(), 1)
	setTime(ONE_MINUTE)
	assert.equal((await store.read()).status, 'MISS')
	assert.equal(calls(), 2)
})

void test('fallback retries do not extend retention, and stop exactly at the retention boundary', async (t) => {
	let warnings = t.mock.method(console, 'warn', () => undefined)
	let {store, setTime, setNext, calls} = harness()
	let first = await store.read()
	let failure = new Error('invalid replacement')
	setNext(failure)
	setTime(ONE_HOUR)
	let stale = await store.read()
	assert.equal(stale.responses, first.responses)
	assert.equal(stale.status, 'STALE')
	assert.equal(stale.freshUntil, ONE_HOUR)
	assert.equal(store.expiresIn(), ONE_MINUTE)
	setTime(ONE_HOUR + ONE_MINUTE - 1)
	assert.equal((await store.read()).status, 'STALE')
	assert.equal(calls(), 2)
	setTime(ONE_HOUR + ONE_MINUTE)
	await store.read()
	assert.equal(calls(), 3)
	setTime(ONE_DAY - 1)
	assert.equal((await store.read()).status, 'STALE')
	assert.equal(store.expiresIn(), 1)
	assert.equal(warnings.mock.callCount(), 3)
	setTime(ONE_DAY)
	await assert.rejects(store.read(), (error: unknown) => error === failure)
	assert.equal(calls(), 4)
	setNext(responses('recovered'))
	setTime(ONE_DAY - 1 + ONE_MINUTE)
	assert.equal((await store.read()).status, 'MISS')
})

void test('retention is checked when a failed refresh finishes, not when it starts', async () => {
	let time = 0
	let initial = true
	let gate = Promise.withResolvers<ScheduleResponses>()
	let store = createScheduleStore({
		load: () => (initial ? Promise.resolve(responses('first')) : gate.promise),
		now: () => time,
	})
	await store.read()
	initial = false
	time = ONE_DAY - 1
	let pending = store.read()
	let failure = new Error('refresh failed after retention expired')
	let rejected = assert.rejects(pending, (error: unknown) => error === failure)
	time = ONE_DAY
	gate.reject(failure)
	await rejected
})

void test('concurrent readers share an in-flight refresh and freshness starts at completion', async () => {
	let time = 0
	let calls = 0
	let gate = Promise.withResolvers<ScheduleResponses>()
	let store = createScheduleStore({
		load: () => {
			calls += 1
			return gate.promise
		},
		now: () => time,
	})
	let readers = [store.read(), store.read(), store.read()]
	assert.notEqual(store.expiresIn(), undefined)
	assert.equal(calls, 1)
	time = ONE_MINUTE
	gate.resolve(responses('loaded'))
	let results = await Promise.all(readers)
	for (let result of results) {
		assert.equal(result.status, 'MISS')
		assert.equal(result.freshUntil, ONE_MINUTE + ONE_HOUR)
		assert.equal(result.responses, results[0]?.responses)
	}
})

for (let outcome of ['success', 'failure'] as const) {
	void test(`clearing an in-flight ${outcome} detaches it from the new store generation`, async () => {
		let calls = 0
		let gate = Promise.withResolvers<ScheduleResponses>()
		let replacement = responses('replacement')
		let store = createScheduleStore({
			load: () => {
				calls += 1
				return calls === 1 ? gate.promise : Promise.resolve(replacement)
			},
			now: () => 0,
		})
		let oldRead = store.read()
		let failure = new Error('detached failure')
		let settled =
			outcome === 'failure'
				? assert.rejects(oldRead, (error: unknown) => error === failure)
				: oldRead
		store.clear()
		assert.equal(store.expiresIn(), undefined)
		assert.equal((await store.read()).responses, replacement)
		if (outcome === 'failure') gate.reject(failure)
		else gate.resolve(responses('detached success'))
		await settled
		assert.equal((await store.read()).responses, replacement)
		assert.equal(calls, 2)
	})
}

void test('clear resets retry throttling, including synchronous loader failures', async () => {
	let calls = 0
	let failure = new Error('synchronous loader failure')
	let store = createScheduleStore({
		load: () => {
			calls += 1
			if (calls === 1) throw failure
			return Promise.resolve(responses('recovered'))
		},
		now: () => 0,
	})
	await assert.rejects(store.read(), (error: unknown) => error === failure)
	await assert.rejects(store.read(), (error: unknown) => error === failure)
	assert.equal(calls, 1)
	store.clear()
	assert.equal((await store.read()).status, 'MISS')
	assert.equal(calls, 2)
})
