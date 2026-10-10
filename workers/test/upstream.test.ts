import {afterEach, beforeEach, expect, test, type MockInstance} from 'vitest'
import {upstream} from '../src/upstream.ts'
import {spyOnFetch} from './spy.ts'

let fetchSpy: MockInstance<typeof fetch>
beforeEach(() => {
	fetchSpy = spyOnFetch()
	fetchSpy.mockImplementation(() => Promise.resolve(new Response('ok')))
})
afterEach(() => fetchSpy.mockRestore())

const sent = () => {
	let [, init] = fetchSpy.mock.calls[0] ?? []
	return {headers: new Headers(init?.headers), redirect: init?.redirect}
}

test('says it is ccc-server, and does not follow a redirect', async () => {
	await upstream('https://example.com/feed')
	expect(sent().headers.get('user-agent')).toBe('ccc-server/2.0')
	expect(sent().redirect).toBe('manual')
})

test('keeps the caller’s headers, but not its user agent or redirect', async () => {
	await upstream('https://example.com/feed', {
		headers: {accept: 'text/calendar', 'user-agent': 'something else'},
		redirect: 'follow',
	})
	expect(sent().headers.get('accept')).toBe('text/calendar')
	expect(sent().headers.get('user-agent')).toBe('ccc-server/2.0')
	expect(sent().redirect).toBe('manual')
})
