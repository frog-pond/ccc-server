import {exports} from 'cloudflare:workers'
import {describe, expect, test} from 'vitest'

// a redirect is the answer, not something to follow
const fetchAt = (url: string) => exports.CachedRoutes.fetch(new Request(url, {redirect: 'manual'}))

// Workers Cache keys a response by its path and query, never its host, so the
// cached entrypoint has to answer by those alone: the campus a Node host stands
// for is put into the path before the request reaches it.
describe('the cached entrypoint', () => {
	test.each(['/v1/transit/bus', '/v1/dictionary', '/', '/v1/routes', '/edu.carleton/transit/bus'])(
		'answers %s the same on every host',
		async (path) => {
			let answers = await Promise.all(
				['carleton.frogpond.tech', 'stolaf.frogpond.tech', 'worker.test'].map(async (host) => {
					let response = await fetchAt(`https://${host}${path}`)
					return {
						status: response.status,
						location: response.headers.get('Location'),
						body: await response.text(),
					}
				}),
			)
			expect(answers[1]).toEqual(answers[0])
			expect(answers[2]).toEqual(answers[0])
		},
	)
})
