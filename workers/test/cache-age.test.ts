import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {CAFES} from '../src/cafes.ts'
import {clock} from '../src/clock.ts'
import {secondsUntilCampusMidnight} from '../src/sources/bonapp.ts'
import {spyOnFetch} from './spy.ts'
import stavHall from './fixtures/stav-hall.html?raw'

const at = (iso: string) => secondsUntilCampusMidnight(new Date(iso))

describe('secondsUntilCampusMidnight', () => {
	test('is the time left in the campus day', () => {
		// 11:30 PM CDT on 21 September is 04:30 UTC on the 22nd
		expect(at('2026-09-22T04:30:00Z')).toBe(30 * 60)
		expect(at('2026-09-22T04:59:59Z')).toBe(1)
	})

	test('is a whole day just after campus midnight, and mid-afternoon', () => {
		expect(at('2026-09-22T05:00:00Z')).toBe(24 * 60 * 60)
		expect(at('2026-09-22T15:00:00Z')).toBe(14 * 60 * 60)
	})

	test('follows the campus clock in winter, when it is an hour behind', () => {
		// 11:30 PM CST on 21 December is 05:30 UTC on the 22nd
		expect(at('2026-12-22T05:30:00Z')).toBe(30 * 60)
		expect(at('2026-12-22T05:00:00Z')).toBe(60 * 60)
	})
})

describe('how long a food response may be kept', () => {
	let fetchSpy: MockInstance<typeof fetch>

	const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

	// storage is not reset between tests, so each starts by emptying the cafés
	beforeEach(async () => {
		for (let url of Object.values(CAFES)) {
			await env.SOURCE.getByName(`bonapp-page:${url}`).purge()
		}
		fetchSpy = spyOnFetch()
		fetchSpy.mockImplementation(() =>
			Promise.resolve(new Response(stavHall, {headers: {'content-type': 'text/html'}})),
		)
	})
	afterEach(() => fetchSpy.mockRestore())

	// a clock set ahead, so the object's alarm is not due while the test runs
	const campusTime = (iso: string) => {
		clock.now = () => Date.parse(iso)
	}

	test('a menu is kept no longer than the campus day it is for', async () => {
		campusTime('2030-01-15T05:30:00Z') // 11:30 PM CST on the 14th
		let response = await get('/v1/food/menu/261')
		expect(response.headers.get('cache-control')).toBe('public, max-age=1800')
	})

	test('café info is kept no longer than the campus day it is for', async () => {
		campusTime('2030-01-15T05:30:00Z')
		let response = await get('/v1/food/cafe/262')
		expect(response.headers.get('cache-control')).toBe('public, max-age=1800')
	})

	// a fetch that starts before campus midnight and ends after it
	const crossMidnight = (respond: () => Response) => {
		campusTime('2030-01-15T05:59:59Z') // 11:59:59 PM CST on the 14th
		fetchSpy.mockImplementation(() => {
			campusTime('2030-01-15T06:00:05Z') // 12:00:05 AM on the 15th
			return Promise.resolve(respond())
		})
	}

	test('a fetch that ends after campus midnight is dated and kept by the day it ended', async () => {
		crossMidnight(() => new Response(stavHall, {headers: {'content-type': 'text/html'}}))
		let response = await get('/v1/food/menu/35')
		let body = await response.json<{days: {date: string}[]}>()
		expect(body.days[0]?.date).toBe('2030-01-15')
		// the new day has nearly all of it left, so an hour, not the one second the old day had
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
	})

	test('a stand-in made after campus midnight is dated by the day it was made', async () => {
		crossMidnight(() => new Response('boom', {status: 503}))
		let body = await (await get('/v1/food/menu/36')).json<{days: {date: string}[]}>()
		expect(body.days[0]?.date).toBe('2030-01-15')
	})

	test('earlier in the day it is still kept an hour', async () => {
		campusTime('2030-01-15T18:00:00Z') // noon CST
		let response = await get('/v1/food/menu/263')
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
	})
})
