import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {clock} from '../src/clock.ts'
import {stolafDirectory} from '../src/sources/stolaf-directory.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const json = (body: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': 'application/json'}})

// each path, and what the Node route reads for it
const LISTS: [string, string][] = [
	['/edu.stolaf/directory/departments', 'https://www.stolaf.edu/directory/departments?format=json'],
	['/edu.stolaf/directory/majors', 'https://www.stolaf.edu/directory/majors?format=json'],
]

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

beforeEach(async () => {
	clock.now = () => Date.parse('2030-01-15T18:00:00Z')
	for (let [, url] of LISTS) await env.SOURCE.getByName(`${stolafDirectory.name}:${url}`).purge()
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

describe.each(LISTS)('GET %s', (path, url) => {
	test('passes the list through, cacheable for ten minutes, read once', async () => {
		let response = await get(path)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual({from: url})
		await get(path)
		expect(fetched()).toEqual([url])
	})

	test('an answer that is not JSON is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(new Response('<html>login</html>')))
		let response = await get(path)
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})

	test('a redirect is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 302, headers: {location: 'https://example.com/'}}),
			),
		)
		expect((await get(path)).status).toBe(502)
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})
})

describe('the directory lists', () => {
	test('are not on Carleton’s table', async () => {
		expect((await get('/edu.carleton/directory/majors')).status).toBe(404)
	})

	test('only the two lists are fetched', async () => {
		let source = stolafDirectory as unknown as {load: (p: {url: string}) => Promise<unknown>}
		await expect(
			source.load({url: 'https://www.stolaf.edu/directory/people?format=json'}),
		).rejects.toThrow('is not a directory list this reads')
		expect(fetched()).toEqual([])
	})
})
