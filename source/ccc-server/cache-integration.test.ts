import assert from 'node:assert/strict'
import {beforeEach, test} from 'node:test'
import * as Sentry from '@sentry/node'
import {http} from '../ccc-lib/http.ts'

// /_cache needs the admin key.
process.env['ADMIN_KEY'] = 'test-admin-key'
const ADMIN = {authorization: 'Bearer test-admin-key'}

// Institution middleware captures the rollout setting when its module loads.
// This test file runs in its own Node test worker, with sharing always enabled.
async function loadInstitutions() {
	const previous = process.env['CACHE_FILL_DEDUPE_PERCENT']
	process.env['CACHE_FILL_DEDUPE_PERCENT'] = '100'
	try {
		return await Promise.all([
			import('./app.ts'),
			import('../ccci-stolaf-college/index.ts'),
			import('../ccci-carleton-college/index.ts'),
		])
	} finally {
		if (previous === undefined) delete process.env['CACHE_FILL_DEDUPE_PERCENT']
		else process.env['CACHE_FILL_DEDUPE_PERCENT'] = previous
	}
}

const [{createApp}, stolaf, carleton] = await loadInstitutions()

beforeEach(() => {
	stolaf.cache.clear()
	carleton.cache.clear()
})

for (const institution of ['stolaf', 'carleton'] as const) {
	void test(
		`${institution} mounted cache shares concurrent fetches and labels metrics`,
		{timeout: 10_000},
		async (t) => {
			const release = Promise.withResolvers<undefined>()
			const joined = Promise.withResolvers<undefined>()
			t.after(() => {
				release.resolve(undefined)
			})
			let bursts = 0
			const metrics: Sentry.Metric[] = []
			const scope = Sentry.getCurrentScope()
			const previousClient = scope.getClient()
			const client = new Sentry.NodeClient({
				dsn: 'https://test@example.com/1',
				integrations: [],
				stackParser: () => [],
				transport: () => ({
					send: () => Promise.resolve({statusCode: 200}),
					flush: () => Promise.resolve(true),
				}),
				beforeSendMetric: (metric) => {
					metrics.push(metric)
					if (metric.name === 'cache.burst' && metric.attributes?.['shared'] === true) {
						bursts++
						if (bursts === 2) joined.resolve(undefined)
					}
					return null
				},
			})
			scope.setClient(client)
			t.after(async () => {
				scope.setClient(previousClient)
				await client.close()
			})
			const emitted = (name: string) => metrics.filter((metric) => metric.name === name)
			const body = [{institution}]
			const upstream = t.mock.method(http, 'get', () => ({
				json: async () => {
					await release.promise
					return body
				},
			}))
			const app = await createApp('all')
			const server = app.listen(0)
			t.after(() => {
				server.closeAllConnections()
				server.close()
			})
			await new Promise((resolve) => server.once('listening', resolve))
			const address = server.address()
			if (!address || typeof address === 'string') throw new Error('no port')
			const base = `http://localhost:${String(address.port)}`
			const route = `/${institution}/v1/tools/help`
			const requests = Promise.all([fetch(`${base}${route}`), fetch(`${base}${route}`)])
			// Wait for both requests to join the burst before allowing upstream to finish.
			await joined.promise
			assert.equal(upstream.mock.callCount(), 1)
			release.resolve(undefined)
			const responses = await requests
			await Promise.all(
				responses.map(async (response) => {
					assert.equal(response.status, 200)
					assert.deepEqual(await response.json(), body)
				}),
			)
			assert.deepEqual(
				responses.map((response) => response.headers.get('Cache-Status')).toSorted(),
				['ccc-server; fwd=uri-miss; collapsed; stored', 'ccc-server; fwd=uri-miss; stored'],
			)
			const hit = await fetch(`${base}${route}`)
			assert.match(hit.headers.get('Cache-Status') ?? '', /^ccc-server; hit(?:;|$)/)
			assert.deepEqual(await hit.json(), body)
			assert.equal(upstream.mock.callCount(), 1)
			const labels = {institution: `${institution}-college`, route}
			assert.partialDeepStrictEqual(emitted('cache.lookup'), [
				{value: 1, attributes: {...labels, result: 'miss'}},
				{value: 1, attributes: {...labels, result: 'hit'}},
				{value: 1, attributes: {...labels, result: 'hit'}},
			])
			assert.partialDeepStrictEqual(emitted('cache.fill'), [
				{value: 1, attributes: {...labels, outcome: 'stored'}},
			])
			assert.partialDeepStrictEqual(emitted('cache.fill.waiters'), [
				{value: 1, attributes: {...labels, outcome: 'stored'}},
			])
			assert.partialDeepStrictEqual(emitted('route.items'), [{value: 1, attributes: labels}])
			const deleted = await fetch(`${base}/${institution}/_cache`, {
				method: 'DELETE',
				headers: ADMIN,
			})
			assert.equal(deleted.status, 204)
			assert.partialDeepStrictEqual(emitted('cache.evicted'), [
				{value: 1, attributes: {institution: `${institution}-college`, scope: 'all'}},
			])
		},
	)
}
