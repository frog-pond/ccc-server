import {test, type TestContext} from 'node:test'
import {request as httpRequest} from 'node:http'
import type {RequestInit} from 'miniflare'
import {bundleSchool, SCHOOLS, startWorker} from './harness.ts'
import {FIXTURES_DIR, replayUpstream} from './fixtures.ts'
import {testableRoutes} from './testable-routes.ts'

const BINDINGS = {GOOGLE_CALENDAR_API_KEY: 'replay'}

// dispatchFetch builds a spec-compliant fetch `Request`, which refuses a body
// on GET/HEAD ("Request with GET/HEAD method cannot have body"), so a GET
// with a body has to go straight over HTTP to the address Miniflare is
// actually listening on instead.
function getWithBody(
	url: URL,
	headers: Record<string, string>,
	body: string,
): Promise<{status: number; body: string}> {
	return new Promise((resolve, reject) => {
		let req = httpRequest(
			url,
			{
				method: 'GET',
				agent: false,
				// without an explicit content-length, node:http sends the body
				// unframed and the Worker sees an empty one
				headers: {...headers, 'content-length': Buffer.byteLength(body)},
			},
			(res) => {
				let chunks: Buffer[] = []
				res.on('data', (chunk: Buffer) => chunks.push(chunk))
				res.on('end', () => {
					resolve({status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8')})
				})
			},
		)
		req.on('error', reject)
		req.end(body)
	})
}

async function worker(t: TestContext, school: (typeof SCHOOLS)[number]) {
	let replay = replayUpstream(FIXTURES_DIR)
	let mf = await startWorker({
		scriptPath: bundleSchool(school),
		bindings: {...BINDINGS, INSTITUTION: school},
		upstream: replay.upstream,
	})
	t.after(() => mf.dispose())
	let baseUrl = await mf.ready
	let get = async (path: string, init?: RequestInit) => {
		let response = await mf.dispatchFetch(`http://localhost${path}`, init)
		return {response, body: await response.text()}
	}
	let getWithBodyOverHttp = (path: string, headers: Record<string, string>, body: string) =>
		getWithBody(new URL(path, baseUrl), headers, body)
	return {get, getWithBody: getWithBodyOverHttp, missing: replay.missing}
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

	void test(`${school}: html-to-md converts a JSON body sent with GET`, async (t) => {
		let {getWithBody} = await worker(t, school)
		let {status, body} = await getWithBody(
			'/v1/util/html-to-md',
			{'content-type': 'application/json'},
			JSON.stringify({text: '<h2>Hi</h2>'}),
		)
		t.assert.equal(status, 200)
		t.assert.equal(body, '## Hi')
	})

	void test(`${school}: html-to-md rejects a non-JSON body with 415`, async (t) => {
		let {get} = await worker(t, school)
		let {response} = await get('/v1/util/html-to-md', {
			headers: {'content-type': 'text/plain'},
		})
		t.assert.equal(response.status, 415)
	})

	void test(`${school}: html-to-md rejects an empty JSON body with 415`, async (t) => {
		let {getWithBody} = await worker(t, school)
		let {status} = await getWithBody(
			'/v1/util/html-to-md',
			{'content-type': 'application/json'},
			'',
		)
		t.assert.equal(status, 415)
	})

	void test(`${school}: html-to-md rejects malformed JSON with 400`, async (t) => {
		let {getWithBody} = await worker(t, school)
		let {status, body} = await getWithBody(
			'/v1/util/html-to-md',
			{'content-type': 'application/json'},
			'{not json',
		)
		t.assert.equal(status, 400)
		t.assert.equal(body, 'request body must be JSON')
	})

	void test(`${school}: html-to-md rejects a body over the 100 KB limit with 413`, async (t) => {
		let {getWithBody} = await worker(t, school)
		let oversized = JSON.stringify({text: 'x'.repeat(200 * 1024)})
		let {status} = await getWithBody(
			'/v1/util/html-to-md',
			{'content-type': 'application/json'},
			oversized,
		)
		t.assert.equal(status, 413)
	})

	void test(`${school}: every testable route answers 200 from recorded upstreams`, async (t) => {
		let {get, missing} = await worker(t, school)
		let routes = JSON.parse((await get('/v1/routes')).body) as {path: string}[]
		// one route at a time, so a failure names its route
		for (let path of testableRoutes(routes)) {
			// eslint-disable-next-line no-await-in-loop
			let {response, body} = await get(path)
			t.assert.equal(
				response.status,
				200,
				`${path} answered ${String(response.status)}: ${body.slice(0, 300)}`,
			)
		}
		t.assert.deepEqual(missing, [], 'these upstream requests have no recording')
	})
}
