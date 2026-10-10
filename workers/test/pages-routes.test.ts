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
	test('is a temporary redirect to the published file, kept ten minutes', async () => {
		let response = await exports.default.fetch(
			new Request(`https://worker.test${path}`, {redirect: 'manual'}),
		)
		expect(response.status).toBe(307)
		expect(response.headers.get('location')).toBe(url)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(fetched()).toEqual([])
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
		}
		for (let [path, [stolafFile, carletonFile]] of Object.entries(files)) {
			expect(stolaf?.[path]?.url).toBe(STOLAF_PAGES(stolafFile).href)
			expect(carleton?.[path]?.url).toBe(CARLETON_PAGES(carletonFile).href)
		}
		expect(carleton?.['/spaces/hours']?.url).toBe(CARLETON_PAGES('building-hours.json').href)
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
