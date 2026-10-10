import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {
	listParams,
	searchParams,
	streamsFrom,
} from '../../source/ccci-stolaf-college/v1/streams-shape.ts'
import {clock} from '../src/clock.ts'
import {STREAMS_URL, streams, streamsQuery} from '../src/sources/streams.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}})

const NOW = new Date('2030-01-15T18:00:00Z')

const entry = (title: string, starttime: string) => ({
	starttime,
	location: 'Boe Chapel',
	eid: 1,
	performer: 'The Choir',
	subtitle: '',
	poster: 'https://www.stolaf.edu/poster.jpg',
	player: 'https://www.stolaf.edu/player',
	status: 'live',
	category: 'music',
	hptitle: title,
	category_textcolor: '#fff',
	category_color: '#000',
	thumb: 'https://www.stolaf.edu/thumb.jpg',
	title,
	iframesrc: 'https://www.stolaf.edu/iframe',
})

const COLLECTION = {
	results: [entry('Vespers', '2030-01-20 19:30'), entry('Recital', '2030-02-01 15:00')],
	meta: {available: 3},
}

// every upstream query a test here makes, so each test starts with none stored
const QUERIES = [
	listParams('upcoming', {}, NOW),
	listParams('archived', {}, NOW),
	listParams('upcoming', {sort: 'descending'}, NOW),
	...[
		{query: 'choir', count: '1'},
		{query: 'choir', count: '1', offset: '1'},
	].map((q) => {
		let parsed = searchParams(q, NOW)
		if ('error' in parsed) throw new Error(parsed.error)
		return parsed.params
	}),
]

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

beforeEach(async () => {
	clock.now = () => NOW.getTime()
	for (let params of QUERIES) {
		await env.SOURCE.getByName(`${streams.name}:${streamsQuery(params)}`).purge()
	}
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation(() => Promise.resolve(json(COLLECTION)))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const fetched = () => fetchSpy.mock.calls.map(([input]) => new URL(String(input)))

describe('GET /edu.stolaf/streams/upcoming', () => {
	test('is the streams the Node route makes of the same answer', async () => {
		let response = await get('/edu.stolaf/streams/upcoming')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual(streamsFrom(COLLECTION).streams)
	})

	test('asks for the next two months, soonest first', async () => {
		await get('/edu.stolaf/streams/upcoming')
		let [asked] = fetched()
		expect(`${asked?.origin ?? ''}${asked?.pathname ?? ''}`).toBe(STREAMS_URL)
		expect(Object.fromEntries(asked?.searchParams ?? [])).toEqual({
			class: 'current',
			date_from: '2030-01-15',
			date_to: '2030-03-15',
			sort: 'ascending',
		})
	})

	test('a second request is served from the object', async () => {
		await get('/edu.stolaf/streams/upcoming')
		await get('/edu.stolaf/streams/upcoming')
		expect(fetched()).toHaveLength(1)
	})

	test('a parameter that does not check out is a 400, with nothing fetched', async () => {
		let response = await get('/edu.stolaf/streams/upcoming?sort=sideways')
		expect(response.status).toBe(400)
		expect(fetched()).toEqual([])
	})

	test('upstream failing with nothing stored is a 502 that does not name the query', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(json({}, 503)))
		let response = await get('/edu.stolaf/streams/upcoming?sort=descending')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.text()).not.toContain('date_from')
	})

	test('a redirect is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 302, headers: {location: 'https://example.com/'}}),
			),
		)
		expect((await get('/edu.stolaf/streams/upcoming')).status).toBe(502)
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})
})

describe('GET /edu.stolaf/streams/archived', () => {
	test('asks for the last two months', async () => {
		let response = await get('/edu.stolaf/streams/archived')
		expect(response.status).toBe(200)
		expect(Object.fromEntries(fetched()[0]?.searchParams ?? [])).toMatchObject({
			class: 'archived',
			date_from: '2029-11-15',
			date_to: '2030-01-15',
		})
	})
})

describe('GET /edu.stolaf/streams/search', () => {
	test('is the page of streams, with links to the others', async () => {
		let response = await get('/edu.stolaf/streams/search?query=choir&count=1')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(streamsFrom(COLLECTION).streams)
		expect(response.headers.get('link')).toBe(
			'</edu.stolaf/streams/search?query=choir&count=1&offset=1>; rel="next", ' +
				'</edu.stolaf/streams/search?query=choir&count=1&offset=2>; rel="last"',
		)
		expect(Object.fromEntries(fetched()[0]?.searchParams ?? [])).toMatchObject({
			squery: 'choir',
			class: 'archived',
			sort: 'descending',
			count: '1',
			offset: '0',
		})
	})

	test('every spelling of one search shares one stored copy', async () => {
		await get('/edu.stolaf/streams/search?query=choir&count=1&offset=1')
		await get('/edu.stolaf/streams/search?offset=1&count=1&query=choir')
		expect(fetched()).toHaveLength(1)
	})

	test('a search without a query, or with a count too large, is a 400', async () => {
		for (let path of [
			'/edu.stolaf/streams/search',
			'/edu.stolaf/streams/search?query=%20',
			'/edu.stolaf/streams/search?query=choir&count=500',
			'/edu.stolaf/streams/search?query=choir&offset=1e2',
		]) {
			expect((await get(path)).status, path).toBe(400)
		}
		expect(fetched()).toEqual([])
	})
})

test('the streams are not on Carleton’s table', async () => {
	expect((await get('/edu.carleton/streams/upcoming')).status).toBe(404)
})
