import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {CAFES} from '../src/cafes.ts'
import {clock} from '../src/clock.ts'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from '../../source/menus-bonapp/types.ts'
import {spyOnFetch} from './spy.ts'
import stavHall from './fixtures/stav-hall.html?raw'
import goldenCafe from './fixtures/stav-hall.cafe.json?raw'
import goldenMenu from './fixtures/stav-hall.menu.json?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const page = (html: string, status = 200) =>
	new Response(html, {status, headers: {'content-type': 'text/html'}})

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

// noon on the campus day of 15 January 2030: far from campus midnight, which
// caps how long a response is kept (the real time fails every night in the last
// hour before it), and ahead of now, so a refresh alarm is not due while a test runs
const NOON = Date.parse('2030-01-15T18:00:00Z')
const CAMPUS_DAY = '2030-01-15'

// storage is not reset between tests, so each starts by emptying the cafés
beforeEach(async () => {
	clock.now = () => NOON
	for (let url of Object.values(CAFES)) {
		await env.SOURCE.getByName(`bonapp-page:${url}`).purge()
	}
	fetchSpy = spyOnFetch()
	// the route logs the failures these tests make on purpose
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation(() => Promise.resolve(page(stavHall)))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const bonappFetches = () =>
	fetchSpy.mock.calls.map(([input]) => String(input)).filter((u) => u.includes('cafebonappetit'))

/// What the Node server's `_menu` / `_cafe` made of the fixture, with today's
/// date where theirs was.
const expected = (golden: string, date: string): unknown =>
	JSON.parse(golden.replaceAll('$DATE', date)) as unknown

const dateOf = (body: {days?: {date: string}[]; cafe?: {days: {date: string}[]}}) =>
	(body.days ?? body.cafe?.days)?.[0]?.date ?? ''

describe('GET /edu.stolaf/food/menu/:cafeId', () => {
	test('is the menu the Node server sends for the same page', async () => {
		let response = await get('/edu.stolaf/food/menu/261')
		expect(response.status).toBe(200)
		let body = await response.json<{days: {date: string}[]}>()
		expect(CafeMenuResponseSchema.safeParse(body).success).toBe(true)
		expect(body).toEqual(expected(goldenMenu, dateOf(body)))
	})

	test('is dated by the campus calendar', async () => {
		let body = await (await get('/edu.stolaf/food/menu/262')).json<{days: {date: string}[]}>()
		expect(dateOf(body)).toBe(CAMPUS_DAY)
	})

	test('is cacheable for an hour, and read from BonApp once', async () => {
		let first = await get('/edu.stolaf/food/menu/263')
		expect(first.headers.get('cache-control')).toBe('public, max-age=3600')
		await get('/edu.stolaf/food/menu/263')
		expect(bonappFetches().filter((u) => u.includes('the-kings-room'))).toHaveLength(1)
	})

	test('a closed café is the closed menu', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('<html>closed</html>')))
		let body = await (
			await get('/edu.stolaf/food/menu/35')
		).json<{items: Record<string, {label: string}>}>()
		expect(body.items['1']?.label).toBe('Closed')
	})

	test('BonApp down with nothing stored is the error menu, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('boom', 503)))
		let response = await get('/edu.stolaf/food/menu/36')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		let body = await response.json<{items: Record<string, {label: string; description: string}>}>()
		expect(CafeMenuResponseSchema.safeParse(body).success).toBe(true)
		expect(body.items['1']?.label).toBe('Could not load the BonApp menu data')
		expect(body.items['1']?.description).toContain('503')
	})

	test('an unknown café is a 400 that lists the known ids, without fetching', async () => {
		let response = await get('/edu.stolaf/food/menu/999')
		expect(response.status).toBe(400)
		expect(await response.text()).toContain('261')
		expect(bonappFetches()).toEqual([])
	})

	test('an id inherited from Object is not a café', async () => {
		expect((await get('/edu.stolaf/food/menu/toString')).status).toBe(400)
	})
})

describe('GET /edu.stolaf/food/cafe/:cafeId', () => {
	test('is the café info the Node server sends for the same page', async () => {
		let response = await get('/edu.stolaf/food/cafe/458')
		expect(response.status).toBe(200)
		let body = await response.json<{cafe: {days: {date: string}[]}}>()
		expect(CafeInfoResponseSchema.safeParse(body).success).toBe(true)
		expect(body).toEqual(expected(goldenCafe, dateOf(body)))
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
	})

	test('BonApp down with nothing stored is the stand-in café, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('boom', 503)))
		let response = await get('/edu.stolaf/food/cafe/34')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		let body = await response.json<{cafe: {message: string}}>()
		expect(body.cafe.message).toBe('Could not load café from BonApp')
	})

	test('an unknown café is a 400', async () => {
		expect((await get('/edu.stolaf/food/cafe/999')).status).toBe(400)
	})
})
