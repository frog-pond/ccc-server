import {env} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {registry} from '../src/registry.ts'
import '../src/worker.ts'
import {bonappPage, parseBonappPage} from '../src/sources/bonapp.ts'
import {spyOnFetch} from './spy.ts'
import stavHall from './fixtures/stav-hall.html?raw'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

const page = (html: string, status = 200) =>
	new Response(html, {status, headers: {'content-type': 'text/html'}})

describe('parseBonappPage', () => {
	test('reads the café, dayparts and menu items out of a real page', () => {
		let parsed = parseBonappPage(stavHall)
		expect(parsed?.current_cafe.name).toBe('Stav Hall')
		expect(Object.keys(parsed?.menu_items ?? {})).toHaveLength(6)
		expect(Object.keys(parsed?.dayparts ?? {}).length).toBeGreaterThan(0)
	})

	test('a page with no Bamco data is a closed café, as null', () => {
		expect(parseBonappPage('<html><body>closed</body></html>')).toBeNull()
	})

	test('a page BonApp has reshaped throws instead of reading as closed', () => {
		let reshaped = stavHall.replace('Bamco.current_cafe = {', 'Bamco.current_cafe = [')
		expect(() => parseBonappPage(reshaped)).toThrow()
	})
})

describe('bonappPage source', () => {
	let fetchSpy: MockInstance<typeof fetch>
	let now = 0
	let url = ''
	let elsewhere = ''

	beforeEach(() => {
		now = Date.parse('2026-09-22T15:00:00Z')
		clock.now = () => now
		// storage is not reset between tests, so each test gets its own café url
		url = `${STAV}?test=${crypto.randomUUID()}`
		elsewhere = `https://example.com/cafe/stav-hall/?test=${crypto.randomUUID()}`
		fetchSpy = spyOnFetch()
		fetchSpy.mockImplementation(() => Promise.resolve(page(stavHall)))
	})

	afterEach(() => fetchSpy.mockRestore())

	// the pool makes fetches of its own, and an alarm an earlier test left behind
	// can fire during this one, so count only fetches of this test's urls
	let fetched = (urls: string[]) =>
		fetchSpy.mock.calls.map(([input]) => String(input)).filter((u) => urls.includes(u))
	const cafeFetches = () => fetched([url, elsewhere])

	const get = () => fetchSource(env, bonappPage, {url})

	test('is registered by the worker entry point', () => {
		expect(registry[bonappPage.name]).toBe(bonappPage)
	})

	test('loads the café page once and serves it fresh', async () => {
		let served = await get()
		expect(served.state).toBe('fresh')
		expect(served.value?.current_cafe.name).toBe('Stav Hall')
		expect(cafeFetches()).toEqual([url])
	})

	test('does not fetch again within the hour', async () => {
		await get()
		now += 59 * MINUTE
		await get()
		expect(cafeFetches()).toEqual([url])
	})

	test('a failed refresh keeps serving the good menu', async () => {
		let good = await get()
		now += 2 * HOUR
		fetchSpy.mockImplementation(() => Promise.resolve(page('boom', 503)))
		let stale = await get()
		expect(stale.value).toEqual(good.value)
		expect(['stale', 'stale-error']).toContain(stale.state)
	})

	test('refuses a url that is not a BonApp café, without fetching', async () => {
		await expect(fetchSource(env, bonappPage, {url: elsewhere})).rejects.toThrow(/not a BonApp/)
		expect(cafeFetches()).toEqual([])
	})

	test('a non-200 response is an error, not a closed café', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('nope', 500)))
		await expect(get()).rejects.toThrow(/500/)
	})

	test('a closed café is served as null', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('<html>closed</html>')))
		expect((await get()).value).toBeNull()
	})

	test('the epoch is the campus date, not the UTC date', () => {
		// 11:30 PM on the 21st in Chicago (CDT), already the 22nd in UTC
		expect(bonappPage.epoch?.(new Date('2026-09-22T04:30:00Z'))).toBe('2026-09-21')
		expect(bonappPage.epoch?.(new Date('2026-09-22T05:30:00Z'))).toBe('2026-09-22')
		// and in winter (CST), the offset is an hour different
		expect(bonappPage.epoch?.(new Date('2026-12-22T05:30:00Z'))).toBe('2026-12-21')
	})
})
