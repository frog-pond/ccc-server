import {env} from 'cloudflare:workers'
import {runInDurableObject} from 'cloudflare:test'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {retryAfterMs} from '../src/conditional.ts'
import {defineSource} from '../src/define-source.ts'
import {registerSource} from '../src/registry.ts'
import {upstream} from '../src/upstream.ts'
import {spyOnFetch} from './spy.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

type Params = {url: string}

/// A source that reads one address, and a second when asked to.
const source = defineSource({
	name: 'test-conditional',
	key: ({url}: Params) => url,
	async load({url}) {
		let response = await upstream(url)
		if (!response.ok) throw new Error(`upstream responded ${String(response.status)}`)
		return {body: await response.text(), total: response.headers.get('x-total')}
	},
	ttl: MINUTE,
	// nothing stale is served, so each read past the ttl loads before answering
	staleIfError: 0,
})
registerSource(source)

let fetchSpy: MockInstance<typeof fetch>
let now = 0
let url = ''

beforeEach(() => {
	now = 1_900_000_000_000
	clock.now = () => now
	// each test its own address, and so its own object
	url = `https://example.test/feed?key=secret-${crypto.randomUUID()}`
	fetchSpy = spyOnFetch()
})
afterEach(() => {
	fetchSpy.mockRestore()
})

const get = () => fetchSource(env, source, {url})
const stub = () => env.SOURCE.getByName(`${source.name}:${url}`)
const sent = (call: number) => new Headers(fetchSpy.mock.calls[call]?.[1]?.headers)

describe('conditional requests', () => {
	test('send the validators the last answer came with, and a 304 is the kept body', async () => {
		fetchSpy.mockImplementationOnce(() =>
			Promise.resolve(
				new Response('<rss>one</rss>', {
					headers: {ETag: '"v1"', 'Last-Modified': 'Fri, 10 Oct 2026 20:00:00 GMT', 'x-total': '3'},
				}),
			),
		)
		expect((await get()).value).toEqual({body: '<rss>one</rss>', total: '3'})
		expect(sent(0).has('If-None-Match')).toBe(false)

		now += 2 * MINUTE
		fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response(null, {status: 304})))
		let served = await get()
		expect(sent(1).get('If-None-Match')).toBe('"v1"')
		expect(sent(1).get('If-Modified-Since')).toBe('Fri, 10 Oct 2026 20:00:00 GMT')
		expect(sent(1).get('User-Agent')).toBe('ccc-server/2.0')
		// a 304 is a fresh read of the same body, headers included
		expect(served).toEqual({
			value: {body: '<rss>one</rss>', total: '3'},
			fetchedAt: now,
			state: 'fresh',
		})

		// and it is kept again for the read after
		now += 2 * MINUTE
		fetchSpy.mockImplementationOnce(() =>
			Promise.resolve(new Response('<rss>two</rss>', {headers: {ETag: '"v2"'}})),
		)
		expect((await get()).value).toEqual({body: '<rss>two</rss>', total: null})
		expect(sent(2).get('If-None-Match')).toBe('"v1"')

		now += 2 * MINUTE
		fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response(null, {status: 304})))
		await get()
		expect(sent(3).get('If-None-Match')).toBe('"v2"')
		expect(sent(3).has('If-Modified-Since')).toBe(false)
	})

	test('an answer without validators is asked for in full next time', async () => {
		fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response('plain')))
		await get()
		now += 2 * MINUTE
		fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response('plain')))
		await get()
		expect(sent(1).has('If-None-Match')).toBe(false)
		expect(sent(1).has('If-Modified-Since')).toBe(false)
	})

	test('a kept answer is stored by a digest of its address, never the address', async () => {
		fetchSpy.mockImplementationOnce(() =>
			Promise.resolve(new Response('x', {headers: {ETag: '"a"'}})),
		)
		await get()
		let keys = await runInDurableObject(stub(), (_do, state) =>
			state.storage.sql.exec<{key: string}>('SELECT key FROM response').toArray(),
		)
		expect(keys).toHaveLength(1)
		expect(keys[0]?.key).toMatch(/^[0-9a-f]{64}$/u)
	})
})

describe('Retry-After', () => {
	test('a 429 is not asked again before the wait it names', async () => {
		fetchSpy.mockImplementationOnce(() =>
			Promise.resolve(new Response('slow down', {status: 429, headers: {'Retry-After': '7200'}})),
		)
		await expect(get()).rejects.toThrow('upstream responded 429')
		let {backoff_until} = await stub().inspect()
		expect(backoff_until).toBe(now + 2 * HOUR)
	})

	test('a 503 without one backs off as any failure does', async () => {
		fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response('down', {status: 503})))
		await expect(get()).rejects.toThrow('upstream responded 503')
		expect((await stub().inspect()).backoff_until).toBe(now + 30_000)
	})

	test('reads seconds or a date, and caps a day', () => {
		let at = Date.parse('2026-10-10T22:00:00Z')
		expect(retryAfterMs('120', at)).toBe(120_000)
		expect(retryAfterMs('Sat, 10 Oct 2026 22:05:00 GMT', at)).toBe(5 * MINUTE)
		expect(retryAfterMs('Sat, 10 Oct 2026 21:00:00 GMT', at)).toBe(0)
		expect(retryAfterMs('9999999', at)).toBe(24 * HOUR)
		expect(retryAfterMs('soon', at)).toBe(0)
		expect(retryAfterMs(null, at)).toBe(0)
	})
})
