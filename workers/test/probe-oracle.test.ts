import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, expect, test, type MockInstance} from 'vitest'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

let fetchSpy: MockInstance<typeof fetch>
beforeEach(() => {
	fetchSpy = spyOnFetch()
})
afterEach(() => fetchSpy.mockRestore())

test('reports how the board and one posting answered', async () => {
	fetchSpy.mockImplementation((input) =>
		Promise.resolve(
			String(input).includes('recruitingCEJobRequisitions?')
				? Response.json({items: [{requisitionList: [{Id: '1'}, {Id: '2'}]}]})
				: Response.json({items: [{ExternalDescriptionStr: 'x'}]}),
		),
	)
	let response = await get('/_probe/oracle')
	expect(response.status).toBe(200)
	expect(response.headers.get('cache-control')).toBe('no-store')
	let body = await response.json<{
		board: {status: number; postings: number}
		detail: {id: string; status: number}
	}>()
	expect(body.board).toMatchObject({status: 200, postings: 2})
	expect(body.detail).toMatchObject({id: '1', status: 200})
	expect(fetchSpy).toHaveBeenCalledTimes(2)
	for (let [input] of fetchSpy.mock.calls) {
		expect(new URL(String(input)).hostname).toBe('fa-ewur-saasfaprod1.fa.ocs.oraclecloud.com')
	}
})

test('reports a challenge page rather than failing', async () => {
	fetchSpy.mockImplementation(() =>
		Promise.resolve(
			new Response('<html>Just a moment...</html>', {
				status: 403,
				headers: {'cf-mitigated': 'challenge'},
			}),
		),
	)
	let response = await get('/_probe/oracle')
	let body = await response.json<{
		board: {status: number; postings: number; headers: Record<string, string>}
	}>()
	expect(body.board).toMatchObject({
		status: 403,
		postings: 0,
		headers: {'cf-mitigated': 'challenge'},
	})
	expect(fetchSpy).toHaveBeenCalledTimes(1)
})
