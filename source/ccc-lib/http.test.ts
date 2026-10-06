import {test} from 'node:test'
import ky from 'ky'
import {countingFetch, metricHost, type UpstreamOutcome} from './http.ts'

function recorder() {
	let told: [string, UpstreamOutcome][] = []
	let record = (host: string, outcome: UpstreamOutcome) => {
		told.push([host, outcome])
	}
	return {told, record}
}

void test('each upstream response is told by host and status class', async (t) => {
	let statuses = [200, 304, 404, 503]
	t.mock.method(globalThis, 'fetch', () =>
		Promise.resolve(new Response(null, {status: statuses.shift() ?? 200})),
	)
	let {told, record} = recorder()
	let fetch = countingFetch(record)

	await fetch('https://example.com/a')
	await fetch(new URL('https://example.com/b'))
	await fetch(new Request('https://api.example.org/c'))
	await fetch('https://example.com:8443/d')

	t.assert.deepEqual(told, [
		['example.com', '2xx'],
		['example.com', '3xx'],
		['api.example.org', '4xx'],
		['example.com:8443', '5xx'],
	])
})

void test('a request that never answers is told as a network failure, and still fails', async (t) => {
	t.mock.method(globalThis, 'fetch', () => Promise.reject(new TypeError('fetch failed')))
	let {told, record} = recorder()

	await t.assert.rejects(countingFetch(record)('https://example.com/'), TypeError)
	t.assert.deepEqual(told, [['example.com', 'network']])
})

void test('a request ky gives up on is told as a timeout', async (t) => {
	t.mock.method(
		globalThis,
		'fetch',
		(input: Parameters<typeof fetch>[0], init?: RequestInit) =>
			new Promise((_resolve, reject) => {
				// ky puts its signal on the Request, as fetch honors it there
				let signal = init?.signal ?? (input instanceof Request ? input.signal : null)
				signal?.addEventListener('abort', () => {
					reject(new DOMException('This operation was aborted', 'AbortError'))
				})
			}),
	)
	let {told, record} = recorder()
	let client = ky.create({fetch: countingFetch(record), timeout: 20, retry: 0})

	await t.assert.rejects(client.get('https://example.com/slow').text(), {name: 'TimeoutError'})
	// ky stops waiting before the aborted fetch settles
	await new Promise((resolve) => setTimeout(resolve, 10))
	t.assert.deepEqual(told, [['example.com', 'timeout']])
})

void test('every attempt ky makes is told, retries included', async (t) => {
	let statuses = [503, 200]
	t.mock.method(globalThis, 'fetch', () =>
		Promise.resolve(new Response('ok', {status: statuses.shift() ?? 200})),
	)
	let {told, record} = recorder()
	let client = ky.create({fetch: countingFetch(record), retry: {limit: 1, delay: () => 0}})

	t.assert.equal(await client.get('https://example.com/').text(), 'ok')
	t.assert.deepEqual(told, [
		['example.com', '5xx'],
		['example.com', '2xx'],
	])
})

void test('a metric names a known upstream by its host, and any other as "other"', (t) => {
	// hosts the server fetches by name
	t.assert.equal(metricHost('stodevx.github.io'), 'stodevx.github.io')
	t.assert.equal(metricHost('www.googleapis.com'), 'www.googleapis.com')
	// any host in a college's own domains
	t.assert.equal(metricHost('athletics.stolaf.edu'), 'athletics.stolaf.edu')
	t.assert.equal(metricHost('carleton.edu'), 'carleton.edu')
	t.assert.equal(metricHost('stolaf.cafebonappetit.com'), 'stolaf.cafebonappetit.com')
	// the port is dropped, so it can't mint a series either
	t.assert.equal(metricHost('www.stolaf.edu:8443'), 'www.stolaf.edu')
	// anything else, including lookalikes and other pages on a shared host
	t.assert.equal(metricHost('example.com'), 'other')
	t.assert.equal(metricHost('evilstolaf.edu'), 'other')
	t.assert.equal(metricHost('stolaf.edu.example.com'), 'other')
	t.assert.equal(metricHost('someone-else.github.io'), 'other')
	t.assert.equal(metricHost('unknown'), 'other')
})
