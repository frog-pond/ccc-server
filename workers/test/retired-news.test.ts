import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {deprecatedWpJson, retiredNnb} from '../../source/feeds/deprecated.ts'
import {clock} from '../src/clock.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string, headers: Record<string, string> = {}) =>
	exports.default.fetch(new Request(`https://worker.test${path}`, {headers}))

const NOW = Date.parse('2030-04-22T15:27:41Z')
const DAY = 24 * 60 * 60 * 1000

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
	clock.now = () => NOW
	fetchSpy = spyOnFetch()
})
afterEach(() => {
	fetchSpy.mockRestore()
})

const NOTICES = [
	{path: '/edu.stolaf/news/oleville', expected: deprecatedWpJson},
	{path: '/edu.stolaf/news/politicole', expected: deprecatedWpJson},
	{path: '/edu.stolaf/news/ksto', expected: deprecatedWpJson},
	{path: '/edu.carleton/news/covid', expected: deprecatedWpJson},
	{path: '/edu.carleton/news/nnb', expected: retiredNnb},
]

describe.each(NOTICES)('GET $path', ({path, expected}) => {
	test('is the notice the Node route answers with, undated', async () => {
		let response = await get(path)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body: unknown = await response.json()
		expect(body).toEqual(expected(null))
		expect(body).toMatchObject([{datePublished: null}])
	})

	test('a client re-checking it any time later is answered with a 304', async () => {
		let tag = (await get(path)).headers.get('etag')
		expect(tag).toBeTruthy()
		clock.now = () => NOW + DAY
		expect((await get(path, {'If-None-Match': tag ?? ''})).status).toBe(304)
	})

	test('fetches nothing', async () => {
		await get(path)
		expect(fetchSpy).not.toHaveBeenCalled()
	})
})

test.each([
	'/edu.carleton/news/oleville',
	'/edu.carleton/news/politicole',
	'/edu.carleton/news/ksto',
	'/edu.stolaf/news/covid',
	'/edu.stolaf/news/nnb',
])('GET %s is a 404', async (path) => {
	expect((await get(path)).status).toBe(404)
})

test('the notices say what they stand in for', () => {
	expect(deprecatedWpJson()[0]).toMatchObject({title: 'Deprecated endpoint'})
	expect(retiredNnb()[0]?.excerpt).toMatch(/Noon News Bulletin is no longer published/)
})
