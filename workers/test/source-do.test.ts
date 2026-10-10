import {env} from 'cloudflare:workers'
import {evictDurableObject, runDurableObjectAlarm, runInDurableObject} from 'cloudflare:test'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {defineSource} from '../src/define-source.ts'
import {registerSource} from '../src/registry.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type Params = {id: string}

const load = vi.fn<(params: Params) => Promise<string>>()
let epoch = 'day-1'

const source = defineSource({
	name: 'test',
	key: ({id}: Params) => id,
	load: (params) => load(params),
	ttl: HOUR,
	staleIfError: DAY,
	epoch: () => epoch,
})
registerSource(source)

let now = 0
let id = ''

// storage is not reset between tests, so each test gets its own source key
beforeEach(() => {
	now = 1_800_000_000_000
	epoch = 'day-1'
	clock.now = () => now
	id = crypto.randomUUID()
	load.mockReset()
	load.mockResolvedValue('v1')
})

const get = () => fetchSource(env, source, {id})
const stub = () => env.SOURCE.getByName(`${source.name}:${id}`)
const alarmAt = () => runInDurableObject(stub(), (_do, state) => state.storage.getAlarm())

function deferred<T>() {
	let resolve!: (value: T) => void
	let promise = new Promise<T>((r) => (resolve = r))
	return {promise, resolve}
}

describe('fresh values', () => {
	test('a cold miss loads once and is fresh', async () => {
		let served = await get()
		expect(served).toEqual({value: 'v1', fetchedAt: now, state: 'fresh'})
		expect(load).toHaveBeenCalledTimes(1)
		expect(load).toHaveBeenCalledWith({id})
	})

	test('a read within the ttl does not load again', async () => {
		await get()
		now += 59 * MINUTE
		expect((await get()).state).toBe('fresh')
		expect(load).toHaveBeenCalledTimes(1)
	})

	test('concurrent cold misses share one upstream fetch', async () => {
		let gate = deferred<string>()
		load.mockReturnValue(gate.promise)

		let reads = Promise.all([get(), get(), get(), get(), get()])
		// hold the fetch open long enough for every read to arrive behind it
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
		await new Promise((resolve) => setTimeout(resolve, 50))
		gate.resolve('shared')

		let served = await reads
		expect(load).toHaveBeenCalledTimes(1)
		expect(served.map((s) => s.value)).toEqual(Array(5).fill('shared'))
		expect(served.every((s) => s.state === 'fresh')).toBe(true)
	})
})

describe('stale-while-revalidate', () => {
	test('a stale read answers at once and refreshes from the alarm', async () => {
		await get()
		load.mockResolvedValue('v2')
		now += HOUR + MINUTE

		let stale = await get()
		expect(stale.state).toBe('stale')
		expect(stale.value).toBe('v1')
		expect(load).toHaveBeenCalledTimes(1)
		expect(await alarmAt()).not.toBeNull()

		expect(await runDurableObjectAlarm(stub())).toBe(true)
		expect(load).toHaveBeenCalledTimes(2)
		expect(await get()).toMatchObject({value: 'v2', state: 'fresh'})
	})

	test('the alarm refreshes ahead of demand and schedules the next one', async () => {
		await get()
		load.mockResolvedValue('v2')
		now += HOUR

		await runDurableObjectAlarm(stub())
		expect(load).toHaveBeenCalledTimes(2)
		expect(await alarmAt()).toBe(now + HOUR)
		expect(await get()).toMatchObject({value: 'v2', state: 'fresh'})
		expect(load).toHaveBeenCalledTimes(2)
	})

	test('stored values survive eviction', async () => {
		await get()
		await evictDurableObject(stub())
		now += 5 * MINUTE

		expect(await get()).toMatchObject({value: 'v1', state: 'fresh'})
		expect(load).toHaveBeenCalledTimes(1)
	})
})

describe('upstream failure', () => {
	test('with nothing stored, the read rejects and backs off', async () => {
		load.mockRejectedValue(new Error('boom'))

		await expect(get()).rejects.toThrow('boom')
		await expect(get()).rejects.toThrow('boom')
		expect(load).toHaveBeenCalledTimes(1)
	})

	test('past staleIfError, a failed refresh still serves the stored value', async () => {
		await get()
		load.mockRejectedValue(new Error('boom'))
		now += HOUR + DAY + MINUTE

		let served = await get()
		expect(served).toMatchObject({value: 'v1', state: 'stale-error'})
		expect(load).toHaveBeenCalledTimes(2)
	})

	test('backoff suppresses upstream calls, then lets one through', async () => {
		await get()
		load.mockRejectedValue(new Error('boom'))
		now += HOUR + DAY + MINUTE
		await get() // fails: backoff 30s
		expect(load).toHaveBeenCalledTimes(2)

		now += 10_000
		expect((await get()).state).toBe('stale-error')
		expect(load).toHaveBeenCalledTimes(2)

		now += 21_000
		load.mockResolvedValue('v2')
		expect(await get()).toMatchObject({value: 'v2', state: 'fresh'})
		expect(load).toHaveBeenCalledTimes(3)
	})

	test('backoff doubles with each consecutive failure', async () => {
		load.mockRejectedValue(new Error('boom'))
		await expect(get()).rejects.toThrow() // 30s
		now += 31_000
		await expect(get()).rejects.toThrow() // 60s
		expect(load).toHaveBeenCalledTimes(2)

		now += 45_000
		await expect(get()).rejects.toThrow()
		expect(load).toHaveBeenCalledTimes(2)

		now += 16_000
		await expect(get()).rejects.toThrow()
		expect(load).toHaveBeenCalledTimes(3)
	})
})

describe('epochs', () => {
	test('a value from an earlier epoch is not served as fresh', async () => {
		await get()
		load.mockResolvedValue('v2')
		epoch = 'day-2'

		expect(await get()).toMatchObject({value: 'v2', state: 'fresh'})
		expect(load).toHaveBeenCalledTimes(2)
	})

	test('an earlier epoch is still better than nothing when upstream is down', async () => {
		await get()
		load.mockRejectedValue(new Error('boom'))
		epoch = 'day-2'

		expect(await get()).toMatchObject({value: 'v1', state: 'stale-error'})
	})
})

describe('lifecycle', () => {
	test('a source nobody reads goes quiet', async () => {
		await get()
		now += 3 * DAY

		expect(await runDurableObjectAlarm(stub())).toBe(true)
		expect(load).toHaveBeenCalledTimes(1)
		expect(await alarmAt()).toBeNull()
	})

	test('purge forgets the value and the alarm', async () => {
		await get()
		await stub().purge()

		expect(await alarmAt()).toBeNull()
		await get()
		expect(load).toHaveBeenCalledTimes(2)
	})

	test('an unregistered source is reported, not run', async () => {
		let unregistered = defineSource({
			name: 'nope',
			key: ({id}: Params) => id,
			load: () => Promise.resolve(''),
			ttl: HOUR,
			staleIfError: DAY,
		})
		await expect(fetchSource(env, unregistered, {id})).rejects.toThrow(/unknown source/)
	})
})
