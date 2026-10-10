import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {registry} from '../src/registry.ts'
import {STOLAF_NEWS_URL, wpNews} from '../src/sources/wp-news.ts'
import {spyOnFetch} from './spy.ts'
import posts from './fixtures/stolaf-posts.json?raw'
import golden from './fixtures/stolaf-news.json?raw'

const HOUR = 60 * 60 * 1000

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const json = (body: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': 'application/json'}})

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

// storage is not reset between tests, so each starts by emptying the feed
beforeEach(async () => {
	// the real time: a refresh alarm set from a clock in the past would be due at once
	clock.now = () => Date.now()
	await env.SOURCE.getByName(`${wpNews.name}:${STOLAF_NEWS_URL}`).purge()
	fetchSpy = spyOnFetch()
	// the route logs the failures these tests make on purpose
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation(() => Promise.resolve(json(posts)))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

// fetches of a host, by its parsed hostname rather than a match in the url
const fetchesOf = (hostname: string) =>
	fetchSpy.mock.calls
		.map(([input]) => String(input))
		.filter((u) => URL.canParse(u) && new URL(u).hostname === hostname)

const newsFetches = () => fetchesOf('wp.stolaf.edu')

describe('GET /edu.stolaf/news/stolaf', () => {
	test('is the feed items the Node code makes of the same posts', async () => {
		let response = await get('/edu.stolaf/news/stolaf')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual(JSON.parse(golden))
		expect(newsFetches()).toEqual([STOLAF_NEWS_URL])
	})

	test('a second request is served from the object, not WordPress', async () => {
		await get('/edu.stolaf/news/stolaf')
		expect((await get('/edu.stolaf/news/stolaf')).status).toBe(200)
		expect(newsFetches()).toHaveLength(1)
	})

	test('WordPress down with nothing stored is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(json('boom', 503)))
		let response = await get('/edu.stolaf/news/stolaf')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.json()).toMatchObject({message: expect.stringContaining('503')})
	})

	test('an answer that is not a list of posts is a 502, not a feed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(json('{"code":"rest_no_route","message":"No route"}')),
		)
		expect((await get('/edu.stolaf/news/stolaf')).status).toBe(502)
	})

	test('a failed refresh keeps serving the last good feed', async () => {
		await get('/edu.stolaf/news/stolaf')
		// two hours on: past the hour it is fresh for, well within the day it is kept
		clock.now = () => Date.now() + 2 * HOUR
		fetchSpy.mockImplementation(() => Promise.resolve(json('boom', 503)))
		let response = await get('/edu.stolaf/news/stolaf')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(JSON.parse(golden))
	})
})

describe('wp-news source', () => {
	test('is registered by the worker entry point', async () => {
		await import('../src/worker.ts')
		expect(registry[wpNews.name]).toBe(wpNews)
	})

	test('refuses a url that is not a St. Olaf WordPress, without fetching', async () => {
		fetchSpy.mockClear()
		await expect(
			fetchSource(env, wpNews, {url: 'https://example.com/wp-json/wp/v2/posts'}),
		).rejects.toThrow(/not a WordPress/)
		expect(fetchesOf('example.com')).toEqual([])
	})
})
