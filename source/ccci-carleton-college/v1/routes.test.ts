import {beforeEach, test} from 'node:test'
import Koa from 'koa'
import {ctxCacheControl} from '../../ccc-koa/ctx-cache-control.ts'
import {noop} from 'lodash-es'
import {withBodyParsers} from '@koa/body-parsers'
import {api, cache} from '../index.ts'

beforeEach(() => {
	cache.clear()
})

/// The institution router includes its response cache middleware.
async function serve(t: test.TestContext) {
	let app = ctxCacheControl(new Koa())
	withBodyParsers(app)
	app.use(api.routes())

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))

	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')
	return `http://localhost:${String(address.port)}`
}

void test('/util/html-to-md accepts its HTML by QUERY, and no longer by POST', async (t) => {
	let base = await serve(t)
	let request = {
		headers: {'content-type': 'application/json'},
		body: JSON.stringify({text: '<b>hi</b>'}),
	}
	let response = await fetch(`${base}/v1/util/html-to-md`, {method: 'QUERY', ...request})
	t.assert.equal(response.status, 200)
	t.assert.equal(await response.text(), '**hi**')
	let posted = await fetch(`${base}/v1/util/html-to-md`, {method: 'POST', ...request})
	t.assert.equal(posted.status, 404)
})

void test('/convos/upcoming/:id reads the id from the path', {timeout: 15_000}, async (t) => {
	let base = await serve(t)
	t.mock.method(console, 'error', noop)
	let response = await fetch(`${base}/v1/convos/upcoming/12345`)
	t.assert.doesNotMatch(await response.text(), /id is required/)
})
