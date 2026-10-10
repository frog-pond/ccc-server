import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {CAFES} from '../src/cafes.ts'
import {clock} from '../src/clock.ts'
import {spyOnFetch} from './spy.ts'
import stavHall from './fixtures/stav-hall.html?raw'
import goldenMenu from './fixtures/stav-hall.menu.json?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const page = (html: string, status = 200) =>
	new Response(html, {status, headers: {'content-type': 'text/html'}})

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

// the menu the Node server sends for the fixture page; every item in it has the
// nutrition the page gave it
const items = (JSON.parse(goldenMenu.replaceAll('$DATE', '2026-09-22')) as {items: object})
	.items as Record<string, unknown>
const [ITEM = ''] = Object.keys(items)

// storage is not reset between tests, and these read every café, so each test
// starts by emptying them
beforeEach(async () => {
	for (let url of Object.values(CAFES)) {
		await env.SOURCE.getByName(`bonapp-page:${url}`).purge()
	}
	// the real time: a refresh alarm set from a clock in the past would be due at once
	clock.now = () => Date.now()
	fetchSpy = spyOnFetch()
	// the route logs the failures these tests make on purpose
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const bonappFetches = () =>
	fetchSpy.mock.calls.map(([input]) => String(input)).filter((u) => u.includes('cafebonappetit'))

describe('GET /v1/food/item/:itemId', () => {
	test('is the item as the menu has it, found in a café page', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page(stavHall)))
		let response = await get(`/v1/food/item/${ITEM}`)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
		expect(await response.json()).toEqual(items[ITEM])
	})

	test('an item no café has is a 404', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page(stavHall)))
		let response = await get('/v1/food/item/1')
		expect(response.status).toBe(404)
		expect(await response.json()).toMatchObject({message: expect.stringContaining('1')})
	})

	test('is found even when some cafés cannot be read', async () => {
		fetchSpy.mockImplementation((input) =>
			Promise.resolve(String(input).includes('burton') ? page('boom', 503) : page(stavHall)),
		)
		let response = await get(`/v1/food/item/${ITEM}`)
		expect(response.status).toBe(200)
	})

	test('not finding it while a café could not be read is a 502, not a 404', async () => {
		fetchSpy.mockImplementation((input) =>
			Promise.resolve(
				String(input).includes('burton') ? page('boom', 503) : page('<html>closed</html>'),
			),
		)
		expect((await get('/v1/food/item/2')).status).toBe(502)
	})

	test('an id that is not a number is a 400, without fetching', async () => {
		fetchSpy.mockClear()
		for (let bad of ['abc', 'toString', '12x', '1234567890123']) {
			expect((await get(`/v1/food/item/${bad}`)).status).toBe(400)
		}
		expect(bonappFetches()).toEqual([])
	})
})
