import {beforeEach, test} from 'node:test'
import Koa from 'koa'
import {ctxCacheControl} from '../../ccc-koa/ctx-cache-control.ts'
import {api, cache} from '../index.ts'
import {CafeMenuResponseSchema} from '../../menus-bonapp/types.ts'

beforeEach(() => {
	cache.clear()
})

/// The institution router includes its response cache middleware.
async function serve(t: test.TestContext) {
	let app = ctxCacheControl(new Koa())
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
