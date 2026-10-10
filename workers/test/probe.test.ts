import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

let fetchSpy: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
beforeEach(() => {
	fetchSpy = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => fetchSpy.mockRestore())

const probed = () =>
	fetchSpy.mock.calls
		.map(([input]) => String(input))
		.filter((u) => !u.startsWith('https://worker.test'))

test('reports what a WordPress site answered, without relaying the body', async () => {
	fetchSpy.mockImplementation(() =>
		Promise.resolve(
			new Response('[{"id":1,"title":{"rendered":"Hello"}}]', {
				status: 200,
				headers: {'content-type': 'application/json', server: 'Apache'},
			}),
		),
	)
	let body = await (await get('/probe/wp-stolaf')).json<Record<string, unknown>>()
	expect(body).toMatchObject({
		name: 'wp-stolaf',
		url: 'https://wp.stolaf.edu/wp-json/wp/v2/posts?per_page=1',
		status: 200,
		server: 'Apache',
		json: true,
	})
	expect(probed()).toEqual(['https://wp.stolaf.edu/wp-json/wp/v2/posts?per_page=1'])
})

test('a block is reported as the status it came back with, not as a failure', async () => {
	fetchSpy.mockImplementation(() => Promise.resolve(new Response('Forbidden', {status: 403})))
	let response = await get('/probe/olafmessenger')
	expect(response.status).toBe(200)
	expect(await response.json()).toMatchObject({status: 403, json: false, snippet: 'Forbidden'})
})

test('a network failure is a 502 with the error', async () => {
	fetchSpy.mockImplementation(() => Promise.reject(new Error('connection refused')))
	let response = await get('/probe/olafmessenger')
	expect(response.status).toBe(502)
	expect(await response.json()).toMatchObject({
		error: expect.stringContaining('connection refused'),
	})
})

test('only the named targets can be probed', async () => {
	let response = await get('/probe/anything-else')
	expect(response.status).toBe(404)
	expect(probed()).toEqual([])
})

test("?as=node sends the Node server's user agent, and by default none is set", async () => {
	fetchSpy.mockImplementation(() => Promise.resolve(new Response('[]', {status: 200})))
	await get('/probe/olafmessenger')
	await get('/probe/olafmessenger?as=node')
	let agents = fetchSpy.mock.calls
		.filter(([input]) => !String(input).startsWith('https://worker.test'))
		.map(([, init]) => new Headers(init?.headers).get('user-agent'))
	expect(agents).toEqual([null, 'ccc-server/0.2.0'])
})
