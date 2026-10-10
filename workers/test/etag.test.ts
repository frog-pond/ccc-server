import {exports} from 'cloudflare:workers'
import {describe, expect, test} from 'vitest'
import {matches} from '../src/etag.ts'

const get = (path: string, headers: HeadersInit = {}) =>
	exports.default.fetch(new Request(`https://worker.test${path}`, {headers}))

describe('ETags', () => {
	test('a successful response carries one, the same for the same body', async () => {
		let first = await get('/')
		let second = await get('/')
		let tag = first.headers.get('etag')
		expect(tag).toMatch(/^"[\w-]{24}"$/u)
		expect(second.headers.get('etag')).toBe(tag)
		expect(await first.json()).toEqual({campuses: ['edu.stolaf', 'edu.carleton']})
	})

	test('a request holding the current body gets a 304 with no body', async () => {
		let tag = (await get('/')).headers.get('etag')!
		let response = await get('/', {'If-None-Match': tag})
		expect(response.status).toBe(304)
		expect(response.headers.get('etag')).toBe(tag)
		expect(await response.text()).toBe('')
	})

	test('a request holding an old body gets the new one', async () => {
		let response = await get('/', {'If-None-Match': '"something-else"'})
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({campuses: ['edu.stolaf', 'edu.carleton']})
	})

	test('an error carries none', async () => {
		let response = await get('/nowhere/at/all')
		expect(response.status).toBe(404)
		expect(response.headers.has('etag')).toBe(false)
	})

	test('a 304 has no content type', async () => {
		let response = await get('/', {'If-None-Match': '*'})
		expect(response.status).toBe(304)
		expect(response.headers.has('content-type')).toBe(false)
	})
})

describe('matches', () => {
	test.each([
		['"abc"', '"abc"', true],
		['W/"abc"', '"abc"', true],
		['"x", "abc"', '"abc"', true],
		['*', '"abc"', true],
		['"abd"', '"abc"', false],
		[null, '"abc"', false],
	])('%s against %s is %s', (header, tag, expected) => {
		expect(matches(header, tag)).toBe(expected)
	})
})
