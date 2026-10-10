import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {GH_PAGES as CARLETON_PAGES} from '../../source/ccci-carleton-college/v1/gh-pages.ts'
import {GH_PAGES as STOLAF_PAGES} from '../../source/ccci-stolaf-college/v1/gh-pages.ts'
import {clock} from '../src/clock.ts'
import {CAMPUSES} from '../src/campuses.ts'
import {pagesJson} from '../src/sources/pages-json.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const json = (body: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': 'application/json'}})

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

// every data file, at the path it is served at
const routes = [...CAMPUSES].flatMap(([prefix, campus]) =>
	Object.entries(campus.files).map(([path, file]) => [`/${prefix}${path}`, file] as const),
)

// storage is not reset between tests, so each starts by emptying the files
beforeEach(async () => {
	clock.now = () => Date.now()
	for (let [, {url}] of routes) await env.SOURCE.getByName(`${pagesJson.name}:${url}`).purge()
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation((input) =>
		Promise.resolve(json(JSON.stringify({from: String(input)}))),
	)
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const fetched = () => fetchSpy.mock.calls.map(([input]) => String(input))

describe.each(routes)('GET %s', (path, {url}) => {
	test('passes the published file through, cacheable for ten minutes', async () => {
		let response = await get(path)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual({from: url})
		expect(fetched()).toEqual([url])
	})

	test('a second request is served from the object', async () => {
		await get(path)
		expect((await get(path)).status).toBe(200)
		expect(fetched()).toHaveLength(1)
	})

	test('the host failing with nothing stored is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(json('boom', 503)))
		let response = await get(path)
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})

	test('a page that is not JSON is a 502, not served as the file', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(new Response('<html>Just a moment</html>')))
		expect((await get(path)).status).toBe(502)
	})

	test('a redirect is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 301, headers: {location: 'https://example.com/'}}),
			),
		)
		expect((await get(path)).status).toBe(502)
		expect(fetched()).toEqual([url])
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})
})

describe('the route table', () => {
	test('a bare path is a 404, and there is no /v1', async () => {
		for (let path of ['/faqs', '/contacts', '/map', '/spaces/hours', '/v1/faqs']) {
			expect((await get(path)).status).toBe(404)
		}
		expect(fetched()).toEqual([])
	})

	test('the files are the ones the Node server fetches', () => {
		let stolaf = CAMPUSES.get('edu.stolaf')?.files
		let carleton = CAMPUSES.get('edu.carleton')?.files
		let files: Record<string, [string, string]> = {
			'/contacts': ['contact-info.json', 'contact-info.json'],
			'/dictionary': ['dictionary.json', 'dictionary-carls.json'],
			'/faqs': ['faqs.json', 'faqs.json'],
			'/tools/help': ['help.json', 'help.json'],
			'/webcams': ['webcams.json', 'webcams.json'],
			'/spaces/hours': ['building-hours.json', 'building-hours.json'],
		}
		for (let [path, [stolafFile, carletonFile]] of Object.entries(files)) {
			expect(stolaf?.[path]?.url).toBe(STOLAF_PAGES(stolafFile).href)
			expect(carleton?.[path]?.url).toBe(CARLETON_PAGES(carletonFile).href)
		}
		for (let [path, file] of Object.entries({
			'/sources': 'sources.json',
			'/spaces/directory': 'building-directory.json',
			'/a-to-z/extras': 'a-to-z.json',
			'/orgs/category-styles': 'org-categories.json',
			'/map/categories': 'map-categories.json',
			'/student-work/areas': 'student-work-areas.json',
			'/student-work/wages': 'student-wages.json',
		})) {
			expect(stolaf?.[path]?.url).toBe(STOLAF_PAGES(file).href)
		}
	})

	test('only the colleges’ own hosts are fetched', async () => {
		let source = pagesJson as unknown as {load: (p: {url: string}) => Promise<unknown>}
		await expect(source.load({url: 'https://example.com/x.json'})).rejects.toThrow(
			'is not a data file this reads',
		)
		expect(fetched()).toEqual([])
	})
})
