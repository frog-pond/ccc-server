import assert from 'node:assert/strict'
import {test} from 'node:test'
import Koa from 'koa'
import {noop} from 'lodash-es'
import {withBodyParsers} from '@koa/body-parsers'
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
]

for (const route of ROUTES) {
	void test(`${route} is registered`, () => {
		assert.ok(api.match(route, 'GET').route)
	})
}

/// The v1 routes behind a bare app, with the server's caching stubbed out.
async function serve(t: test.TestContext) {
	let app = new Koa()
	app.context['cacheControl'] = noop
	app.context['cached'] = () => false
	withBodyParsers(app)
	app.use(api.routes())

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))

	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')
	return `http://localhost:${String(address.port)}`
}

void test('/util/html-to-md accepts its HTML by POST', async (t) => {
	let base = await serve(t)
	let response = await fetch(`${base}/v1/util/html-to-md`, {
		method: 'POST',
		headers: {'content-type': 'application/json'},
		body: JSON.stringify({text: '<b>hi</b>'}),
	})
	assert.equal(response.status, 200)
	assert.equal(await response.text(), '**hi**')
})
