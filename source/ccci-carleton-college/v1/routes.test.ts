import {test} from 'node:test'
import Koa from 'koa'
import {noop} from 'lodash-es'
import {withBodyParsers} from '@koa/body-parsers'
import {api} from './index.ts'

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
	t.assert.equal(response.status, 200)
	t.assert.equal(await response.text(), '**hi**')
})

void test('/convos/upcoming/:id reads the id from the path', {timeout: 15_000}, async (t) => {
	let base = await serve(t)
	t.mock.method(console, 'error', noop)
	let response = await fetch(`${base}/v1/convos/upcoming/12345`)
	t.assert.doesNotMatch(await response.text(), /id is required/)
})
