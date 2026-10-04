import assert from 'node:assert/strict'
import {test} from 'node:test'
import Koa from 'koa'
import {noop} from 'lodash-es'
import {api} from './index.ts'

/// The routes the app is pointed at; each must exist, or the app's
/// request for it 404s.
const ROUTES = [
	'/v1/a-to-z/extras',
	'/v1/orgs/category-styles',
	'/v1/map/categories',
	'/v1/student-work/areas',
	'/v1/student-work/wages',
	'/v1/map/style',
	'/v1/map/style-dark',
	'/v1/courses/catalog.db',
	'/v1/orgs/agape',
]

for (const route of ROUTES) {
	void test(`${route} is registered`, () => {
		assert.ok(api.match(route, 'GET').route)
	})
}

/// `/orgs/:uri` would match these too, were it registered before them.
for (const route of ['/v1/orgs/categories', '/v1/orgs/category-styles']) {
	void test(`${route} is not taken for an org`, () => {
		assert.equal(api.match(route, 'GET').pathAndMethod[0]?.path, route)
	})
}

void test('/orgs/:uri refuses a slug Presence could not have, without asking Presence', async (t) => {
	let app = new Koa()
	app.context['cacheControl'] = noop
	app.context['cached'] = () => false
	app.use(api.routes())
	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))
	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')

	// The test's own requests go through the real fetch; any the server makes
	// to Presence would go through the mock.
	let send = globalThis.fetch.bind(globalThis)
	let upstream = t.mock.method(globalThis, 'fetch')
	let base = `http://localhost:${String(address.port)}/v1/orgs`
	let slugs = ['Agape', 'a_b', '-agape', '..%2F..%2Fsecret']
	let statuses = await Promise.all(
		slugs.map(async (slug) => (await send(`${base}/${slug}`)).status),
	)

	assert.deepEqual(statuses, [404, 404, 404, 404])
	assert.equal(upstream.mock.callCount(), 0)
})
