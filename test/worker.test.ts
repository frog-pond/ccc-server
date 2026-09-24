import {test, type TestContext} from 'node:test'
import type {RequestInit} from 'miniflare'
import {bundleSchool, SCHOOLS, startWorker} from './harness.ts'
import {FIXTURES_DIR, replayUpstream} from './fixtures.ts'

const BINDINGS = {GOOGLE_CALENDAR_API_KEY: 'replay'}

async function worker(t: TestContext, school: (typeof SCHOOLS)[number]) {
	let replay = replayUpstream(FIXTURES_DIR)
	let mf = await startWorker({
		scriptPath: bundleSchool(school),
		bindings: {...BINDINGS, INSTITUTION: school},
		upstream: replay.upstream,
	})
	t.after(() => mf.dispose())
	let get = async (path: string, init?: RequestInit) => {
		let response = await mf.dispatchFetch(`http://localhost${path}`, init)
		return {response, body: await response.text()}
	}
	return {get, missing: replay.missing}
}

for (let school of SCHOOLS) {
	void test(`${school}: /ping answers pong`, async (t) => {
		let {get} = await worker(t, school)
		let {body} = await get('/ping')
		t.assert.equal(body, 'pong')
	})

	void test(`${school}: /v1/routes lists paths, display names, and params`, async (t: TestContext) => {
		let {get} = await worker(t, school)
		let routes = JSON.parse((await get('/v1/routes')).body) as {
			path: string
			displayName: string
			params: string[]
		}[]
		let menu = routes.find((r) => r.path === '/v1/food/menu/:cafeId')
		t.assert.deepEqual(menu, {
			path: '/v1/food/menu/:cafeId',
			displayName: 'food/menu/:cafeId',
			params: ['cafeId'],
		})
		t.assert.equal(new Set(routes.map((r) => r.path)).size, routes.length, 'no duplicates')
		t.assert.ok(routes.some((r) => r.path === '/v1/routes'))
	})

	void test(`${school}: a missing required query parameter answers 400`, async (t) => {
		let {get} = await worker(t, school)
		let {response, body} = await get('/v1/news/rss')
		t.assert.equal(response.status, 400)
		t.assert.equal(body, '?url is required')
	})

	void test(`${school}: an unknown cafeId answers 400`, async (t) => {
		let {get} = await worker(t, school)
		let {response} = await get('/v1/food/menu/x?cafeId=nope')
		t.assert.equal(response.status, 400)
	})

	// html-to-md reads a GET body, but Miniflare's dispatchFetch builds a
	// fetch `Request`, which throws "Request with GET/HEAD method cannot have
	// body" before the request ever reaches the Worker — a test-client
	// limitation, not a Worker bug. Verified against `wrangler dev` instead:
	//   curl -s -X GET -H 'content-type: application/json' \
	//     --data '{"text":"<h2>Hi</h2>"}' localhost:8787/v1/util/html-to-md
	//   → 200, body "## Hi"
	//   curl -s -o /dev/null -w '%{http_code}\n' -X GET \
	//     -H 'content-type: text/plain' --data 'x' localhost:8787/v1/util/html-to-md
	//   → 415
}
