import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {canonicalKey} from '../../source/ccci-stolaf-college/v1/mess-shape.ts'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {registry} from '../src/registry.ts'
import {CARLETONIAN, MESSENGER, wordpressApi} from '../src/sources/wordpress-api.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const POSTS = JSON.stringify([
	{id: 2, date: '2030-04-22T10:00:00', title: {rendered: 'Second story'}},
	{id: 1, date: '2030-04-21T10:00:00', title: {rendered: 'First story'}},
])
const POST = JSON.stringify({id: 36238, title: {rendered: 'One story'}})

const wordpress = (body: string, status = 200, headers: Record<string, string> = {}) =>
	new Response(body, {
		status,
		headers: {'content-type': 'application/json; charset=UTF-8', ...headers},
	})

// the objects these tests read, by the path and query each is kept under
const KEYS = [
	['posts', 'per_page=10&_embed=true'],
	['posts', 'per_page=10&_embed=true&page=2'],
	['posts/36238', '_embed=true'],
	['posts/404', ''],
] as const

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

beforeEach(async () => {
	clock.now = () => Date.now()
	for (let {upstream} of [MESSENGER, CARLETONIAN]) {
		for (let [path, query] of KEYS) {
			let key = canonicalKey(path, new URLSearchParams(query))
			await env.SOURCE.getByName(`${wordpressApi.name}:${upstream}/${key}`).purge()
		}
	}
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

// fetches of either paper
const paperFetches = () =>
	fetchSpy.mock.calls
		.map(([input]) => String(input))
		.filter(
			(u) =>
				URL.canParse(u) &&
				[MESSENGER, CARLETONIAN].some(
					({upstream}) => new URL(u).hostname === new URL(upstream).hostname,
				),
		)

const PAPERS = [
	{name: 'mess', site: MESSENGER},
	{name: 'carletonian', site: CARLETONIAN},
]

describe.each(PAPERS)('GET /news/$name/wp/v2/:resource', ({name, site}) => {
	const UPSTREAM = site.upstream
	test("passes the paper's answer on, with its paging headers and links", async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(wordpress(POSTS, 200, {'x-wp-total': '30', 'x-wp-totalpages': '3'})),
		)
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true`)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(response.headers.get('content-type')).toBe('application/json; charset=UTF-8')
		expect(response.headers.get('x-wp-total')).toBe('30')
		expect(response.headers.get('x-wp-totalpages')).toBe('3')
		expect(response.headers.get('link')).toBe(
			[
				`</edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true>; rel="first"`,
				`</edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true&page=2>; rel="next"`,
				`</edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true&page=3>; rel="last"`,
			].join(', '),
		)
		expect(await response.text()).toBe(POSTS)
		expect(paperFetches()).toEqual([`${UPSTREAM}/posts?per_page=10&_embed=true`])
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})

	test('is served on both campus prefixes', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(wordpress(POSTS)))
		for (let campus of ['edu.stolaf', 'edu.carleton']) {
			let response = await get(`/${campus}/news/${name}/wp/v2/posts?per_page=10&_embed=true`)
			expect(response.status).toBe(200)
		}
	})

	test('a request spelled another way is served from the same object', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(wordpress(POSTS)))
		await get(`/edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true`)
		let again = await get(`/edu.stolaf/news/${name}/wp/v2/posts?_embed=true&per_page=10`)
		expect(again.status).toBe(200)
		expect(await again.text()).toBe(POSTS)
		expect(paperFetches()).toHaveLength(1)
	})

	test('one post, by id', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(wordpress(POST)))
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts/36238?_embed=true`)
		expect(response.status).toBe(200)
		expect(response.headers.get('link')).toBeNull()
		expect(await response.text()).toBe(POST)
		expect(paperFetches()).toEqual([`${UPSTREAM}/posts/36238?_embed=true`])
	})

	test('a byte order mark ahead of the JSON is dropped', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(wordpress(`﻿${POSTS}`)))
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true`)
		expect(await response.text()).toBe(POSTS)
	})

	test("the paper's 4xx is passed on, not marked cacheable", async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(wordpress('{"code":"rest_post_invalid_id"}', 404)),
		)
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts/404`)
		expect(response.status).toBe(404)
		expect(response.headers.get('cache-control')).toBeNull()
		expect(await response.json()).toEqual({code: 'rest_post_invalid_id'})
	})

	test.each([
		['a resource the app does not read', '/posts/../users', 404],
		['an unknown resource', '/users', 404],
		['an id that is not a number', '/posts/abc', 404],
		['an unknown parameter', '/posts?search=hello', 400],
		['a malformed parameter', '/posts?per_page=lots', 400],
	])('%s is refused without asking the paper', async (_, rest, status) => {
		let response = await get(`/edu.stolaf/news/${name}/wp/v2${rest}`)
		expect(response.status).toBe(status)
		expect(paperFetches()).toEqual([])
	})

	test('a bot challenge with nothing stored is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response('<html>Just a moment...</html>', {
					status: 403,
					headers: {'content-type': 'text/html', 'cf-mitigated': 'challenge'},
				}),
			),
		)
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true`)
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.json()).toEqual({message: `${site.paper} could not be reached for posts`})
	})

	test('JSON that does not parse is a 502, not kept', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(wordpress('<b>Warning</b>: PHP ate the JSON')),
		)
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true`)
		expect(response.status).toBe(502)
	})

	test('a redirect is an error, and is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 301, headers: {location: 'https://elsewhere.example/'}}),
			),
		)
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true`)
		expect(response.status).toBe(502)
		expect(fetchSpy.mock.calls.map(([i]) => String(i))).not.toContain('https://elsewhere.example/')
	})

	test('the second page links back to the first', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(wordpress(POSTS, 200, {'x-wp-totalpages': '3'})),
		)
		let response = await get(`/edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true&page=2`)
		expect(response.headers.get('link')).toContain(
			`</edu.stolaf/news/${name}/wp/v2/posts?per_page=10&_embed=true>; rel="prev"`,
		)
	})
})

describe('the WordPress API source', () => {
	test('is registered by the worker entry point', async () => {
		await import('../src/worker.ts')
		expect(registry[wordpressApi.name]).toBe(wordpressApi)
	})

	test('refuses a request the app does not make, without fetching', async () => {
		await expect(
			fetchSource(env, wordpressApi, {site: MESSENGER, path: 'users', query: ''}),
		).rejects.toThrow(/not a request this reads/)
		await expect(
			fetchSource(env, wordpressApi, {site: CARLETONIAN, path: 'posts/1/revisions', query: ''}),
		).rejects.toThrow(/not a request this reads/)
		expect(paperFetches()).toEqual([])
	})

	test('refuses a site it does not read, without fetching', async () => {
		let site = {upstream: 'https://example.com/wp-json/wp/v2', paper: 'Example'}
		await expect(fetchSource(env, wordpressApi, {site, path: 'posts', query: ''})).rejects.toThrow(
			/not a WordPress API this reads/,
		)
		expect(
			fetchSpy.mock.calls.map(([i]) => String(i)).filter((u) => u.includes('example.com')),
		).toEqual([])
		expect(paperFetches()).toEqual([])
	})
})
