import {test} from 'node:test'
import Koa from 'koa'
import {noop} from 'lodash-es'
import {api} from '../index.ts'
import {CafeMenuResponseSchema} from '../../menus-bonapp/types.ts'

/// The v1 routes behind a bare app, with the server's caching stubbed out.
async function serve(t: test.TestContext) {
	let app = new Koa()
	app.context['cacheControl'] = noop
	app.context['cached'] = () => false
	app.use(api.routes())

	let server = app.listen(0)
	t.after(() => server.close())
	await new Promise((resolve) => server.once('listening', resolve))

	let address = server.address()
	if (!address || typeof address === 'string') throw new Error('no port')
	return `http://localhost:${String(address.port)}`
}

void test('/food/menu/:cafeId reads the cafe from the path', {timeout: 15_000}, async (t) => {
	let base = await serve(t)
	let response = await fetch(`${base}/v1/food/menu/261`)
	t.assert.equal(response.status, 200)
	let body: unknown = await response.json()
	t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(body))
})

void test('/food/menu/:cafeId refuses an unknown cafe, listing the known ids', async (t) => {
	let base = await serve(t)
	let response = await fetch(`${base}/v1/food/menu/999`)
	t.assert.equal(response.status, 400)
	t.assert.match(await response.text(), /261/)
})

void test('/food/cafe/:cafeId refuses an id inherited from Object', async (t) => {
	let base = await serve(t)
	let response = await fetch(`${base}/v1/food/cafe/toString`)
	t.assert.equal(response.status, 400)
})
