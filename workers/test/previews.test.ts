import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {previewName} from '../src/previews.ts'
import {spyOnFetch} from './spy.ts'

const PULLS = 'https://api.github.com/repos/frog-pond/ccc-server/pulls?state=open&per_page=100'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const pull = (number: number, ref: string, repo = 'frog-pond/ccc-server') => ({
	number,
	title: `PR ${number.toFixed(0)}`,
	html_url: `https://github.com/frog-pond/ccc-server/pull/${number.toFixed(0)}`,
	head: {ref, repo: {full_name: repo}},
	base: {repo: {full_name: 'frog-pond/ccc-server'}},
})

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
	fetchSpy = spyOnFetch()
})
afterEach(() => fetchSpy.mockRestore())

describe('previewName', () => {
	// branches and the Preview names Cloudflare posted on their pull requests
	test.each([
		['renovate/node-24.x', 'renovate-node-24-x'],
		['renovate/jdx-mise-action-5.x', 'renovate-jdx-mise-action-5-x'],
		['claude/project-thread-ar6di1-stale-if-error', 'claude-project-thread-ar6di1-stale-if-error'],
		['hawkrives-patch-1', 'hawkrives-patch-1'],
		['wip/news-outage-notice', 'wip-news-outage-notice'],
	])('%s is %s', (branch, name) => {
		expect(previewName(branch)).toBe(name)
	})
})

describe('GET /previews', () => {
	test('lists the open pull requests with their Preview URLs', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				Response.json([pull(1256, 'renovate/vitest-monorepo'), pull(1254, 'renovate/node-24.x')]),
			),
		)
		let response = await get('/previews')
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
		expect(await response.json()).toEqual([
			{
				number: 1256,
				title: 'PR 1256',
				branch: 'renovate/vitest-monorepo',
				prUrl: 'https://github.com/frog-pond/ccc-server/pull/1256',
				previewUrl: 'https://renovate-vitest-monorepo-ccc-server.frog-pond-d8f.workers.dev',
			},
			{
				number: 1254,
				title: 'PR 1254',
				branch: 'renovate/node-24.x',
				prUrl: 'https://github.com/frog-pond/ccc-server/pull/1254',
				previewUrl: 'https://renovate-node-24-x-ccc-server.frog-pond-d8f.workers.dev',
			},
		])
		let [input, init] = fetchSpy.mock.calls[0] ?? []
		expect(String(input)).toBe(PULLS)
		expect(new Headers(init?.headers).get('User-Agent')).toBe('ccc-server/2.0')
	})

	test('a pull request from a fork has no Preview', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(Response.json([pull(1300, 'patch-1', 'someone/ccc-server')])),
		)
		let [only] = await (await get('/previews')).json<{previewUrl: string | null}[]>()
		expect(only?.previewUrl).toBeNull()
	})

	test('a GitHub failure is a 502, kept briefly', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(new Response('rate limited', {status: 403})))
		let response = await get('/previews')
		expect(response.status).toBe(502)
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
		expect(await response.json()).toEqual({message: 'GitHub answered 403'})
	})
})
