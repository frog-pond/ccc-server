import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {registry} from '../src/registry.ts'
import {CARLETONIAN_URL, KRLX_URL, rssNews} from '../src/sources/rss-news.ts'
import {CARLETON_NOW_URL, wpNews} from '../src/sources/wp-news.ts'
import {spyOnFetch} from './spy.ts'
import carletonPosts from './fixtures/carleton-posts.json?raw'
import carletonNow from './fixtures/carleton-now.json?raw'
import carletonianFeed from './fixtures/carletonian-feed.xml?raw'
import carletonian from './fixtures/carletonian.json?raw'
import krlxFeed from './fixtures/krlx-feed.xml?raw'
import krlx from './fixtures/krlx.json?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const answer = (body: string, type: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': type}})

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

// the feeds differ only in where they come from and what they are shaped by
const FEEDS = [
	{
		name: 'Carleton News',
		path: '/edu.carleton/news/carleton-now',
		url: CARLETON_NOW_URL,
		source: `${wpNews.name}:${CARLETON_NOW_URL}`,
		upstream: () => answer(carletonPosts, 'application/json'),
		expected: carletonNow,
	},
	{
		name: 'The Carletonian',
		path: '/edu.carleton/news/carletonian',
		url: CARLETONIAN_URL,
		source: `${rssNews.name}:${CARLETONIAN_URL}`,
		upstream: () => answer(carletonianFeed, 'application/rss+xml'),
		expected: carletonian,
	},
	{
		name: 'KRLX',
		path: '/edu.carleton/news/krlx',
		url: KRLX_URL,
		source: `${rssNews.name}:${KRLX_URL}`,
		upstream: () => answer(krlxFeed, 'application/rss+xml'),
		expected: krlx,
	},
]

// storage is not reset between tests, so each starts by emptying the feeds
beforeEach(async () => {
	// the real time: a refresh alarm set from a clock in the past would be due at once
	clock.now = () => Date.now()
	for (let feed of FEEDS) await env.SOURCE.getByName(feed.source).purge()
	fetchSpy = spyOnFetch()
	// the routes log the failures these tests make on purpose
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const callsTo = (url: string) => fetchSpy.mock.calls.filter(([input]) => String(input) === url)

describe.each(FEEDS)('$name', ({path, url, upstream, expected}) => {
	test('is the feed items the Node code makes of the same feed', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(upstream()))
		let response = await get(path)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual(JSON.parse(expected))
		expect(callsTo(url)).toHaveLength(1)
		// the host is checked once, so a redirect is not followed
		expect(callsTo(url)[0]?.[1]).toMatchObject({redirect: 'manual'})
	})

	test('a second request is served from the object, not the site', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(upstream()))
		await get(path)
		expect((await get(path)).status).toBe(200)
		expect(callsTo(url)).toHaveLength(1)
	})

	test('the site down with nothing stored is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(answer('boom', 'text/plain', 503)))
		let response = await get(path)
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.json()).toMatchObject({message: expect.stringContaining('503')})
	})

	test('an answer that is not the feed is a 502, not an empty feed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(answer('<html><body>Just a moment...</body></html>', 'text/html')),
		)
		expect((await get(path)).status).toBe(502)
	})

	test('a redirect is an error, and is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 301, headers: {location: 'https://elsewhere.example/'}}),
			),
		)
		let response = await get(path)
		expect(response.status).toBe(502)
		expect(await response.json()).toMatchObject({message: expect.stringContaining('301')})
		expect(fetchSpy.mock.calls.map(([i]) => String(i))).not.toContain('https://elsewhere.example/')
	})
})

describe('the news sources', () => {
	test('are registered by the worker entry point', async () => {
		await import('../src/worker.ts')
		expect(registry[rssNews.name]).toBe(rssNews)
		expect(registry[wpNews.name]).toBe(wpNews)
	})

	test('the RSS source refuses a url that is not one it reads, without fetching', async () => {
		fetchSpy.mockClear()
		await expect(fetchSource(env, rssNews, {url: 'https://example.com/feed/'})).rejects.toThrow(
			/not an RSS feed/,
		)
		expect(
			fetchSpy.mock.calls.filter(([i]) => new URL(String(i)).hostname === 'example.com'),
		).toEqual([])
	})

	test('the WordPress source reads Carleton, and still refuses other hosts', async () => {
		fetchSpy.mockClear()
		await expect(
			fetchSource(env, wpNews, {url: 'https://example.com/wp-json/wp/v2/posts'}),
		).rejects.toThrow(/not a WordPress feed/)
	})
})
