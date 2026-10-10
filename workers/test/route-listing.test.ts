import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {CAMPUSES} from '../src/campuses.ts'
import {clock} from '../src/clock.ts'
import {campusPaths} from '../src/routes.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) =>
	exports.default.fetch(new Request(`https://worker.test${path}`, {redirect: 'manual'}))

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

beforeEach(() => {
	clock.now = () => Date.parse('2030-01-15T18:00:00Z')
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	// every upstream failing: a route that exists is then a 502 or a stand-in,
	// never a 404
	fetchSpy.mockImplementation(() => Promise.resolve(new Response('boom', {status: 503})))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

// a value for each part of a path a route reads, one each route accepts
const SAMPLE: Record<string, string> = {
	cafeId: '261',
	resource: 'posts',
	id: '1',
	group: 'spaces',
	name: 'the-cage.webp',
	uri: 'no-such-org',
	query: 'choir',
}

describe.each([...CAMPUSES.keys()])('GET /%s/routes', (prefix) => {
	test('lists every route, in the Node listing’s shape, sorted by path', async () => {
		let response = await get(`/${prefix}/routes`)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body = await response.json<{path: string; displayName: string; params: string[]}[]>()
		expect(body).toContainEqual({
			path: `/${prefix}/food/menu/:cafeId`,
			displayName: 'food/menu/:cafeId',
			methods: ['GET'],
			params: ['cafeId'],
		})
		expect(body.map(({path}) => path)).toEqual(body.map(({path}) => path).toSorted())
		expect(new Set(body.map(({path}) => path)).size).toBe(body.length)
	})

	test('every route it lists is one the router serves', async () => {
		let campus = CAMPUSES.get(prefix)
		if (!campus) throw new Error(prefix)
		for (let path of campusPaths(campus)) {
			let concrete = path.replace(/:([a-zA-Z]+)/gu, (_, name: string) => SAMPLE[name] ?? name)
			let response = await get(`/${prefix}${concrete}`)
			// the org uri is checked against the stored list, which is a 404 for one it lacks
			if (path === '/orgs/uri/:uri') continue
			expect(response.status, path).not.toBe(404)
		}
	})
})
