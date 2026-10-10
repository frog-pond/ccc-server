import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {CAFES} from '../src/cafes.ts'
import {STOLAF_NEWS_URL, wpNews} from '../src/sources/wp-news.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const STAV = CAFES['261'] ?? ''

// a source checks the host it was asked for once; a redirect would then carry
// the fetch to a host it never checked
const redirect = () =>
	new Response(null, {status: 301, headers: {location: 'https://elsewhere.example/'}})

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

const callTo = (url: string) => fetchSpy.mock.calls.find(([input]) => String(input) === url)

// storage is not reset between tests, so each starts by emptying what it reads
beforeEach(async () => {
	await env.SOURCE.getByName(`${wpNews.name}:${STOLAF_NEWS_URL}`).purge()
	await env.SOURCE.getByName(`bonapp-page:${STAV}`).purge()
	fetchSpy = spyOnFetch()
	// the routes log the failures these tests make on purpose
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation(() => Promise.resolve(redirect()))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

describe.each([
	{
		name: 'the St. Olaf news feed',
		path: '/edu.stolaf/news/stolaf',
		url: STOLAF_NEWS_URL,
		field: 'message',
	},
	{name: 'a café page', path: '/edu.stolaf/bonapp/261', url: STAV, field: 'error'},
])('$name', ({path, url, field}) => {
	test('is fetched without following redirects', async () => {
		await get(path)
		expect(callTo(url)?.[1]).toMatchObject({redirect: 'manual'})
	})

	test('answering with a redirect is an error, not followed', async () => {
		let response = await get(path)
		expect(response.status).toBe(502)
		expect(await response.json()).toMatchObject({[field]: expect.stringContaining('301')})
		expect(fetchSpy.mock.calls.map(([i]) => String(i))).not.toContain('https://elsewhere.example/')
	})
})
