import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {clock} from '../src/clock.ts'
import stavHall from './fixtures/stav-hall.html?raw'

const STOLAF = 'https://stolaf.cafebonappetit.com/cafe'

const page = (html: string, status = 200) =>
	new Response(html, {status, headers: {'content-type': 'text/html'}})

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

let fetchSpy: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

// storage is not reset between tests, so each test reads a café of its own
beforeEach(() => {
	// the real time: a refresh alarm set from a clock in the past would be due at once
	clock.now = () => Date.now()
	fetchSpy = vi.spyOn(globalThis, 'fetch')
	fetchSpy.mockImplementation(() => Promise.resolve(page(stavHall)))
})
afterEach(() => fetchSpy.mockRestore())

const fetched = (url: string) =>
	fetchSpy.mock.calls.map(([input]) => String(input)).filter((u) => u === url)

describe('GET /bonapp/:cafeId', () => {
	test('summarises the café page, and says how it was served', async () => {
		let response = await get('/bonapp/261')
		expect(response.status).toBe(200)
		let body = await response.json<Record<string, unknown>>()
		expect(body).toMatchObject({
			cafeId: '261',
			url: `${STOLAF}/stav-hall/`,
			state: 'fresh',
			summary: {name: 'Stav Hall', itemCount: 6},
		})
		expect(typeof body['fetchedAt']).toBe('number')
		expect((body['summary'] as {dayparts: string[]}).dayparts.length).toBeGreaterThan(0)
		expect(body).not.toHaveProperty('page')
		expect(fetched(`${STOLAF}/stav-hall/`)).toHaveLength(1)
	})

	test('?full=1 includes the whole parsed page', async () => {
		let response = await get('/bonapp/262?full=1')
		let body = await response.json<{page: {current_cafe: {name: string}; menu_items: object}}>()
		expect(body.page.current_cafe.name).toBe('Stav Hall')
		expect(Object.keys(body.page.menu_items)).toHaveLength(6)
	})

	test('a second request is served from the object, not BonApp', async () => {
		await get('/bonapp/263')
		let again = await get('/bonapp/263')
		expect(again.status).toBe(200)
		expect(fetched(`${STOLAF}/the-kings-room/`)).toHaveLength(1)
	})

	test('a closed café has a null summary', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('<html>closed</html>')))
		let body = await (await get('/bonapp/35')).json<{summary: unknown}>()
		expect(body.summary).toBeNull()
	})

	test('an unknown café is a 404 that lists the known ids', async () => {
		let response = await get('/bonapp/999')
		expect(response.status).toBe(404)
		let body = await response.json<{known: string[]}>()
		expect(body.known).toContain('261')
		expect(fetchSpy.mock.calls.filter(([i]) => String(i).includes('cafebonappetit'))).toHaveLength(
			0,
		)
	})

	test('an inherited property name is not a café', async () => {
		expect((await get('/bonapp/__proto__')).status).toBe(404)
	})

	test('BonApp being down with nothing stored is a 502, not a 200', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('boom', 503)))
		let response = await get('/bonapp/36')
		expect(response.status).toBe(502)
		expect(await response.json()).toMatchObject({error: expect.stringContaining('503')})
	})
})

describe('other paths', () => {
	test('/ lists the cafés', async () => {
		let response = await get('/')
		expect(response.status).toBe(200)
		let body = await response.json<{cafes: Record<string, string>}>()
		expect(body.cafes['261']).toBe(`${STOLAF}/stav-hall/`)
	})

	test('anything else is a 404', async () => {
		expect((await get('/nope')).status).toBe(404)
	})
})
