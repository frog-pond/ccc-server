import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {NAMED_CAFES} from '../src/cafes.ts'
import {clock} from '../src/clock.ts'
import {spyOnFetch} from './spy.ts'
import stavHall from './fixtures/stav-hall.html?raw'
import goldenCafe from './fixtures/stav-hall.cafe.json?raw'
import goldenMenu from './fixtures/stav-hall.menu.json?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const page = (html: string, status = 200) =>
	new Response(html, {status, headers: {'content-type': 'text/html'}})

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

// noon on a campus day, ahead of now, so a refresh alarm is not due
const NOON = Date.parse('2030-01-15T18:00:00Z')
const CAMPUS_DAY = '2030-01-15'

beforeEach(async () => {
	clock.now = () => NOON
	for (let url of Object.values(NAMED_CAFES)) {
		await env.SOURCE.getByName(`bonapp-page:${url}`).purge()
	}
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation(() => Promise.resolve(page(stavHall)))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const fetched = () => fetchSpy.mock.calls.map(([input]) => String(input))

const expected = (golden: string): unknown =>
	JSON.parse(golden.replaceAll('$DATE', CAMPUS_DAY)) as unknown

// CAFE_URLS in source/ccci-stolaf-college/v1/menu.ts, which pulls in the
// Node server's http client and so cannot be imported here
const CAFE_URLS = {
	stav: 'https://stolaf.cafebonappetit.com/cafe/stav-hall/',
	cage: 'https://stolaf.cafebonappetit.com/cafe/the-cage/',
	kingsRoom: 'https://stolaf.cafebonappetit.com/cafe/the-kings-room/',
	cave: 'https://stolaf.cafebonappetit.com/cafe/the-cave/',
	burton: 'https://carleton.cafebonappetit.com/cafe/burton/',
	ldc: 'https://carleton.cafebonappetit.com/cafe/east-hall/',
	sayles: 'https://carleton.cafebonappetit.com/cafe/sayles-cafe/',
	weitz: 'https://carleton.cafebonappetit.com/cafe/weitz-cafe/',
	schulze: 'https://carleton.cafebonappetit.com/cafe/schulze-cafe/',
}

// the Node server's named routes, and the café each reads
const NODE_NAMED: Record<string, string> = {
	'stav-hall': CAFE_URLS.stav,
	'the-cage': CAFE_URLS.cage,
	'kings-room': CAFE_URLS.kingsRoom,
	'the-cave': CAFE_URLS.cave,
	burton: CAFE_URLS.burton,
	ldc: CAFE_URLS.ldc,
	sayles: CAFE_URLS.sayles,
	weitz: CAFE_URLS.weitz,
	schulze: CAFE_URLS.schulze,
}

describe('GET /food/named/{menu,cafe}/:name', () => {
	test('names the cafés the Node server’s named routes read', () => {
		expect(NAMED_CAFES).toEqual(NODE_NAMED)
	})

	test.each(['edu.stolaf', 'edu.carleton'])(
		'on %s, the menu is the one the id route sends for the same page',
		async (prefix) => {
			let response = await get(`/${prefix}/food/named/menu/stav-hall`)
			expect(response.status).toBe(200)
			expect(response.headers.get('cache-control')).toBe('public, max-age=600')
			expect(await response.json()).toEqual(expected(goldenMenu))
			expect(fetched()).toEqual([CAFE_URLS.stav])
		},
	)

	test('the café info is the one the id route sends', async () => {
		let response = await get('/edu.stolaf/food/named/cafe/stav-hall')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(expected(goldenCafe))
	})

	test('reads the café each name stands for, and shares its copy with the id route', async () => {
		await get('/edu.carleton/food/named/menu/the-cave')
		await get('/edu.carleton/food/named/cafe/schulze')
		await get('/edu.stolaf/food/named/menu/stav-hall')
		await get('/edu.stolaf/food/menu/261')
		expect(fetched()).toEqual([CAFE_URLS.cave, CAFE_URLS.schulze, CAFE_URLS.stav])
	})

	test('BonApp failing is the stand-in the id route sends', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(page('boom', 503)))
		let response = await get('/edu.stolaf/food/named/menu/the-cage')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})

	test('an unknown name is a 404, and nothing is fetched', async () => {
		for (let path of [
			'/edu.stolaf/food/named/menu/nowhere',
			'/edu.stolaf/food/named/cafe/the-pause',
			'/edu.stolaf/food/named/menu/toString',
		]) {
			expect((await get(path)).status, path).toBe(404)
		}
		expect(fetched()).toEqual([])
	})
})
