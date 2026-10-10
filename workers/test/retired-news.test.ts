import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {deprecatedWpJson, retiredNnb} from '../../source/feeds/deprecated.ts'
import {clock} from '../src/clock.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const NOW = Date.parse('2030-04-22T15:27:41Z')
const HOUR_START = '2030-04-22T15:00:00.000Z'

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
	test('is the notice the Node route answers with, dated at the start of the hour', async () => {
		let response = await get(path)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body: unknown = await response.json()
		expect(body).toEqual(expected(new Date(HOUR_START)))
		expect(body).toMatchObject([{datePublished: HOUR_START}])
	})

	test('a client re-checking it later in the hour is answered with a 304', async () => {
		let tag = (await get(path)).headers.get('etag')
		expect(tag).toBeTruthy()
		clock.now = () => NOW + 20 * 60 * 1000
		let again = await exports.default.fetch(
			new Request(`https://worker.test${path}`, {headers: {'If-None-Match': tag ?? ''}}),
		)
		expect(again.status).toBe(304)
	})

	test('fetches nothing', async () => {
		await get(path)
		expect(fetchSpy).not.toHaveBeenCalled()
	})
})

test('the notices say what they stand in for', () => {
	expect(deprecatedWpJson()[0]).toMatchObject({title: 'Deprecated endpoint'})
	expect(retiredNnb()[0]?.excerpt).toMatch(/Noon News Bulletin is no longer published/)
})
