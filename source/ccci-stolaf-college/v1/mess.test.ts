import {test, mock, type TestContext} from 'node:test'
import type {AddressInfo} from 'node:net'
import Router from '@koa/router'
import Koa from 'koa'

import {makeWordpressRoute, paginationLinks, rulesFor, withPage} from './mess.ts'
import {STORED_HEADERS} from '../../ccc-lib/stored-headers.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import type {Context, ContextState, RouterState} from '../../ccc-server/context.ts'
import {cachable, type CacheObject} from '../../ccc-koa/cache.ts'
import {ctxCacheControl} from '../../ccc-koa/ctx-cache-control.ts'

const query = (querystring: string) => new URLSearchParams(querystring)

void test('rulesFor', async (t) => {
	await t.test('allows every request the app makes', (t: TestContext) => {
		let requests: [string, string | undefined, string][] = [
			['posts', undefined, 'per_page=50&_embed=true&page=3'],
			['posts', undefined, 'categories=12&per_page=30&_embed=true'],
			['posts', undefined, 'include=1,2,3&per_page=100&_embed=true'],
			['posts', undefined, 'categories=12&staff_name=390&per_page=7&_embed=true'],
			['posts', undefined, 'per_page=100&page=2&_fields=id,date,title,categories,featured_media'],
			['posts', '36238', '_embed=true'],
			['posts', '36238', '_fields=content'],
			['categories', undefined, 'per_page=100&_fields=id,name,parent'],
			[
				'media',
				undefined,
				'include=4,5&per_page=100&_fields=id,source_url,media_details,caption,alt_text',
			],
			['staff_profile', undefined, 'staff_name=390&_embed=true'],
			[
				'staff_profile',
				undefined,
				'staff_year=7&per_page=100&_embed=wp:featuredmedia,wp:term&_fields=id,title,content,excerpt,featured_media,_links,_embedded&page=2',
			],
			['staff_year', undefined, 'hide_empty=true&per_page=100&_fields=id,name'],
			['pages', undefined, 'slug=about&_fields=content'],
		]
		for (let [resource, id, querystring] of requests) {
			let verdict = rulesFor(resource, id, query(querystring))
			t.assert.ok('rules' in verdict, `${resource} ${id ?? ''} ?${querystring}`)
		}
	})

	await t.test('refuses a resource it does not serve with a 404', (t: TestContext) => {
		for (let resource of ['users', 'settings', 'constructor', '__proto__', 'toString', '']) {
			let verdict = rulesFor(resource, undefined, query(''))
			t.assert.ok('refusal' in verdict && verdict.refusal.status === 404, resource)
		}
	})

	await t.test(
		'refuses an id on anything but posts, and an id that is not a number',
		(t: TestContext) => {
			for (let [resource, id] of [
				['categories', '3'],
				['posts', 'abc'],
				['posts', '1.5'],
			] as const) {
				let verdict = rulesFor(resource, id, query(''))
				t.assert.ok('refusal' in verdict && verdict.refusal.status === 404, `${resource}/${id}`)
			}
		},
	)

	await t.test(
		'refuses an unknown, repeated or malformed parameter with a 400',
		(t: TestContext) => {
			for (let querystring of [
				'search=hello',
				'per_page=50&per_page=60',
				'per_page=lots',
				'include=1;2',
				'_embed=yes',
				'_fields=id,<script>',
				'cachebust=1',
				// each a fresh cache key and a fresh fetch from the paper, for no answer the app needs
				'page=01',
				'per_page=101',
				`include=${Array.from({length: 101}, (_, i) => String(i + 1)).join(',')}`,
				'_fields=id,secret',
				'_embed=wp:author',
			]) {
				let verdict = rulesFor('posts', undefined, query(querystring))
				t.assert.ok('refusal' in verdict && verdict.refusal.status === 400, querystring)
			}
			let slug = rulesFor('pages', undefined, query('slug=../about'))
			t.assert.ok('refusal' in slug && slug.refusal.status === 400)
		},
	)

	await t.test('refuses an id written with leading zeros', (t: TestContext) => {
		let verdict = rulesFor('posts', '0036238', query(''))
		t.assert.ok('refusal' in verdict && verdict.refusal.status === 404)
	})
})

void test('withPage', async (t) => {
	await t.test('sets page last, as the app appends it', (t: TestContext) => {
		t.assert.equal(withPage('per_page=50&_embed=true', 3), 'per_page=50&_embed=true&page=3')
		t.assert.equal(withPage('per_page=50&page=2&_embed=true', 3), 'per_page=50&_embed=true&page=3')
	})

	await t.test(
		'drops page for the first page, which the app asks for without one',
		(t: TestContext) => {
			t.assert.equal(withPage('per_page=50&_embed=true&page=4', 1), 'per_page=50&_embed=true')
			t.assert.equal(withPage('page=4', 1), '')
		},
	)

	await t.test('replaces a page whose name came percent-encoded', (t: TestContext) => {
		t.assert.equal(withPage('per_page=2&%70age=2', 3), 'per_page=2&page=3')
	})

	await t.test(
		'leaves the rest of the query as it came, encoded commas and all',
		(t: TestContext) => {
			t.assert.equal(
				withPage('_fields=id%2Cdate&per_page=2', 2),
				'_fields=id%2Cdate&per_page=2&page=2',
			)
		},
	)
})

void test('paginationLinks', async (t) => {
	const path = '/v1/news/mess/wp/v2/posts'

	await t.test('gives first, prev, next and last for a middle page', (t: TestContext) => {
		t.assert.equal(
			paginationLinks(path, 'per_page=2&page=2', 5),
			[
				`<${path}?per_page=2>; rel="first"`,
				`<${path}?per_page=2>; rel="prev"`,
				`<${path}?per_page=2&page=3>; rel="next"`,
				`<${path}?per_page=2&page=5>; rel="last"`,
			].join(', '),
		)
	})

	await t.test('gives no prev on the first page and no next on the last', (t: TestContext) => {
		t.assert.equal(
			paginationLinks(path, 'per_page=2', 2),
			`<${path}?per_page=2>; rel="first", <${path}?per_page=2&page=2>; rel="next", <${path}?per_page=2&page=2>; rel="last"`,
		)
		t.assert.equal(
			paginationLinks(path, 'per_page=2&page=2', 2),
			`<${path}?per_page=2>; rel="first", <${path}?per_page=2>; rel="prev", <${path}?per_page=2&page=2>; rel="last"`,
		)
	})

	await t.test('gives a bare path when the query held only the page', (t: TestContext) => {
		t.assert.equal(
			paginationLinks(path, 'page=2', 2),
			`<${path}>; rel="first", <${path}>; rel="prev", <${path}?page=2>; rel="last"`,
		)
	})

	await t.test('gives nothing for an empty list', (t: TestContext) => {
		t.assert.equal(paginationLinks(path, 'per_page=2', 0), undefined)
	})
})

/// A stand-in for Koa's context with what the route uses, recording the headers it sets.
function makeContext(path: string, params: {resource: string; id?: string}, querystring = '') {
	let headers = new Map<string, string>()
	let raw = {
		path,
		params,
		querystring,
		cached: mock.fn((_maxAge?: number) => false),
		cacheControl: mock.fn((maxAge: number) => {
			headers.set('cache-control', `public, max-age=${String(maxAge / 1000)}`)
		}),
		setCacheTTL: mock.fn((_maxAge: number) => undefined),
		cacheDetail: mock.fn((_detail: string) => undefined),
		remove(name: string) {
			headers.delete(name.toLowerCase())
		},
		set(name: string | Record<string, string>, value?: string) {
			let entries = typeof name === 'string' ? [[name, value ?? '']] : Object.entries(name)
			for (let [key = '', val = ''] of entries) headers.set(key.toLowerCase(), val)
		},
		throw(status: number, message: string): never {
			throw Object.assign(new Error(message), {status})
		},
		status: 200,
		type: '',
		body: null as unknown,
	}
	return {ctx: raw as unknown as Context, raw, headers}
}

/// Answers every fetch with `response()`, until restored.
function answerWith(t: TestContext, response: () => Promise<Response>) {
	let fetch = mock.method(globalThis, 'fetch', response)
	t.after(() => {
		fetch.mock.restore()
	})
	return {
		urls: () => fetch.mock.calls.map((call) => (call.arguments[0] as unknown as Request).url),
		restore: () => {
			fetch.mock.restore()
		},
	}
}

const json = (
	body: unknown,
	{status = 200, headers = {}}: {status?: number; headers?: Record<string, string>} = {},
) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {'content-type': 'application/json; charset=UTF-8', ...headers},
	})

const POSTS = '/v1/news/mess/wp/v2/posts'

void test('wordpress', async (t) => {
	await t.test(
		'passes a list through with its paging headers, and links its pages',
		async (t: TestContext) => {
			let {urls} = answerWith(t, () =>
				Promise.resolve(json([{id: 1}], {headers: {'x-wp-total': '9', 'x-wp-totalpages': '5'}})),
			)
			let {ctx, raw, headers} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2&page=2')

			await makeWordpressRoute()(ctx)

			t.assert.deepEqual(urls(), [
				'https://olafmessenger.com/wp-json/wp/v2/posts?per_page=2&page=2',
			])
			t.assert.equal(raw.status, 200)
			t.assert.equal(String(raw.body), '[{"id":1}]')
			t.assert.match(raw.type, /json/u)
			t.assert.equal(headers.get('x-wp-total'), '9')
			t.assert.equal(headers.get('x-wp-totalpages'), '5')
			t.assert.equal(headers.get('link'), paginationLinks(POSTS, 'per_page=2&page=2', 5))
			t.assert.deepEqual(raw.cached.mock.calls[0]?.arguments, [5 * ONE_MINUTE])
			t.assert.deepEqual(raw.cacheControl.mock.calls[0]?.arguments, [5 * ONE_MINUTE])
		},
	)

	await t.test('forwards one post by id, with no Link', async (t: TestContext) => {
		let {urls} = answerWith(t, () => Promise.resolve(json({id: 36238})))
		let {ctx, raw, headers} = makeContext(
			`${POSTS}/36238`,
			{resource: 'posts', id: '36238'},
			'_embed=true',
		)

		await makeWordpressRoute()(ctx)

		t.assert.deepEqual(urls(), ['https://olafmessenger.com/wp-json/wp/v2/posts/36238?_embed=true'])
		t.assert.equal(String(raw.body), '{"id":36238}')
		t.assert.equal(headers.has('link'), false)
	})

	await t.test(
		"passes WordPress's 400 for a page past the last through, uncached",
		async (t: TestContext) => {
			answerWith(t, () =>
				Promise.resolve(json({code: 'rest_post_invalid_page_number'}, {status: 400})),
			)
			let {ctx, raw, headers} = makeContext(POSTS, {resource: 'posts'}, 'per_page=50&page=9999')

			await makeWordpressRoute()(ctx)

			t.assert.equal(raw.status, 400)
			t.assert.equal(String(raw.body), '{"code":"rest_post_invalid_page_number"}')
			// nothing tells a phone or a proxy to keep it
			t.assert.equal(headers.has('cache-control'), false)
		},
	)

	await t.test(
		'refuses a request outside the allowlist without asking the paper',
		async (t: TestContext) => {
			let {urls} = answerWith(t, () => Promise.resolve(json([])))
			let {ctx} = makeContext('/v1/news/mess/wp/v2/users', {resource: 'users'})

			await t.assert.rejects(makeWordpressRoute()(ctx), {status: 404})
			t.assert.deepEqual(urls(), [])
		},
	)

	await t.test(
		'serves the last good copy when the paper is slower than its timeout',
		{timeout: 5_000},
		async (t: TestContext) => {
			let route = makeWordpressRoute({timeout: 50})

			let good = answerWith(t, () => Promise.resolve(json([{id: 1}])))
			await route(makeContext(POSTS, {resource: 'posts'}, 'per_page=2').ctx)
			good.restore()

			// a paper that never answers, until the request is given up
			answerWith(
				t,
				((request: Request) =>
					new Promise<Response>((_resolve, reject) => {
						request.signal.addEventListener('abort', () => {
							reject(new DOMException('The operation was aborted', 'AbortError'))
						})
					})) as unknown as () => Promise<Response>,
			)
			let {ctx, raw} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')
			await route(ctx)

			t.assert.equal(String(raw.body), '[{"id":1}]')
		},
	)

	await t.test(
		'keeps the category tree’s last good copy however many other spellings of it are asked for',
		async (t: TestContext) => {
			let route = makeWordpressRoute()
			let path = '/v1/news/mess/wp/v2/categories'
			let real = 'per_page=100&_fields=id,name,parent'
			let up = answerWith(t, () => Promise.resolve(json([{id: 1, name: 'News'}])))
			await route(makeContext(path, {resource: 'categories'}, real).ctx)

			let spellings = [
				'per_page=100&_fields=id,parent,name',
				'per_page=100&_fields=name,id,parent',
				'per_page=100&_fields=name,parent,id',
				'per_page=100&_fields=parent,id,name',
				'per_page=100&_fields=parent,name,id',
				'_fields=id,name,parent&per_page=100',
				'per_page=%31%30%30&_fields=id,name,parent',
				'per_page=1%30%30&_fields=id,name,parent',
				'per_page=10%30&_fields=id,name,parent',
				'per_page=%3100&_fields=id,name,parent',
			]
			for (let querystring of spellings) {
				// eslint-disable-next-line no-await-in-loop
				await route(makeContext(path, {resource: 'categories'}, querystring).ctx)
			}
			up.restore()

			answerWith(t, () => Promise.resolve(new Response('down', {status: 503})))
			let {ctx, raw} = makeContext(path, {resource: 'categories'}, real)
			await route(ctx)

			t.assert.equal(String(raw.body), '[{"id":1,"name":"News"}]')
		},
	)

	await t.test(
		'reads an answer with a byte order mark as JSON, and passes it on without one',
		async (t: TestContext) => {
			answerWith(t, () =>
				Promise.resolve(
					new Response('\uFEFF[{"id":1}]', {
						headers: {'content-type': 'application/json; charset=UTF-8'},
					}),
				),
			)
			let {ctx, raw} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')

			await makeWordpressRoute()(ctx)

			t.assert.equal(raw.status, 200)
			t.assert.equal(String(raw.body), '[{"id":1}]')
		},
	)

	await t.test(
		'links pages only of a list this route lets the app page through',
		async (t: TestContext) => {
			answerWith(t, () => Promise.resolve(json([{id: 1}], {headers: {'x-wp-totalpages': '3'}})))
			let {ctx, headers} = makeContext(
				'/v1/news/mess/wp/v2/categories',
				{resource: 'categories'},
				'per_page=10',
			)

			await makeWordpressRoute()(ctx)

			t.assert.equal(headers.get('x-wp-totalpages'), '3')
			t.assert.equal(headers.has('link'), false)
		},
	)

	await t.test(
		'keeps the last good copy of a story read often, however many others are fetched',
		async (t: TestContext) => {
			let route = makeWordpressRoute()
			let story = (id: number, cached = false) => {
				let made = makeContext(`${POSTS}/${String(id)}`, {resource: 'posts', id: String(id)})
				made.raw.cached = mock.fn((_maxAge?: number) => cached)
				return made
			}
			let up = answerWith(t, () => Promise.resolve(json({id: 1})))
			await route(story(1).ctx)

			for (let id = 2; id <= 401; id++) {
				// eslint-disable-next-line no-await-in-loop
				await route(story(id).ctx)
				// story 1 is read again and again, from the response cache
				// eslint-disable-next-line no-await-in-loop
				if (id % 20 === 0) await route(story(1, true).ctx)
			}
			up.restore()

			answerWith(t, () => Promise.resolve(new Response('down', {status: 503})))
			let {ctx, raw} = story(1)
			await route(ctx)

			t.assert.equal(String(raw.body), '{"id":1}')
		},
	)

	await t.test('lets go of the body of an answer it will not use', async (t: TestContext) => {
		let cancelled = false
		answerWith(t, () =>
			Promise.resolve(
				new Response(
					new ReadableStream({
						cancel() {
							cancelled = true
						},
					}),
					{status: 503, headers: {'content-type': 'application/json'}},
				),
			),
		)
		let {ctx} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')

		await t.assert.rejects(makeWordpressRoute()(ctx), {status: 502})
		t.assert.equal(cancelled, true)
	})

	await t.test(
		'keeps the category tree’s last good copy however many stories are read',
		async (t: TestContext) => {
			let route = makeWordpressRoute()
			let up = answerWith(t, () => Promise.resolve(json([{id: 1, name: 'News'}])))
			let categories = () =>
				makeContext('/v1/news/mess/wp/v2/categories', {resource: 'categories'}, 'per_page=100')
			await route(categories().ctx)

			for (let id = 1; id <= 700; id++) {
				// eslint-disable-next-line no-await-in-loop
				await route(makeContext(`${POSTS}/${String(id)}`, {resource: 'posts', id: String(id)}).ctx)
			}
			up.restore()

			answerWith(t, () => Promise.resolve(new Response('down', {status: 503})))
			let {ctx, raw} = categories()
			await route(ctx)

			t.assert.equal(String(raw.body), '[{"id":1,"name":"News"}]')
		},
	)

	const failures: [string, () => Promise<Response>][] = [
		['a 5xx', () => Promise.resolve(new Response('down', {status: 503}))],
		['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
		[
			'an HTML page in place of JSON',
			() =>
				Promise.resolve(
					new Response('<html>wait</html>', {headers: {'content-type': 'text/html'}}),
				),
		],
		// WordPress with display_errors on puts a PHP warning ahead of its JSON
		[
			'a PHP warning in a JSON answer',
			() =>
				Promise.resolve(
					new Response('<br /><b>Warning</b>: oops<br />[{"id":2}]', {
						headers: {'content-type': 'application/json; charset=UTF-8'},
					}),
				),
		],
		[
			'an answer with no Content-Type',
			() => Promise.resolve(new Response(new TextEncoder().encode('[{"id":2}]'))),
		],
		// every phone reaches the paper from this server's one address, which a rate limit or a
		// firewall may answer for
		['a rate limit', () => Promise.resolve(json({code: 'too_many_requests'}, {status: 429}))],
		['a firewall block', () => Promise.resolve(json({code: 'rest_forbidden'}, {status: 403}))],
	]
	for (let [failure, response] of failures) {
		// each failure's subtests share no state, but node:test runs them one at a time anyway
		// eslint-disable-next-line no-await-in-loop
		await t.test(`serves the last good copy on ${failure}, briefly`, async (t: TestContext) => {
			let route = makeWordpressRoute()

			let good = answerWith(t, () =>
				Promise.resolve(json([{id: 1}], {headers: {'x-wp-totalpages': '3'}})),
			)
			await route(makeContext(POSTS, {resource: 'posts'}, 'per_page=2').ctx)
			good.restore()

			answerWith(t, response)
			let {ctx, raw, headers} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')
			await route(ctx)

			t.assert.equal(raw.status, 200)
			t.assert.equal(String(raw.body), '[{"id":1}]')
			t.assert.equal(headers.get('x-wp-totalpages'), '3')
			t.assert.ok(headers.get('link')?.includes('rel="next"'))
			t.assert.deepEqual(raw.cacheDetail.mock.calls[0]?.arguments, ['stale'])
		})
	}

	await t.test('is a 502 on an outage with no copy to serve', async (t: TestContext) => {
		answerWith(t, () => Promise.resolve(new Response('down', {status: 503})))
		let {ctx} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')

		await t.assert.rejects(makeWordpressRoute()(ctx), {status: 502})
	})

	await t.test('does not ask the paper again for a URL it just failed', async (t: TestContext) => {
		let route = makeWordpressRoute()
		let {urls} = answerWith(t, () => Promise.resolve(new Response('down', {status: 503})))

		await t.assert.rejects(route(makeContext(POSTS, {resource: 'posts'}, 'per_page=2').ctx), {
			status: 502,
		})
		// the same request, spelled another way
		await t.assert.rejects(route(makeContext(POSTS, {resource: 'posts'}, 'per_page=%32').ctx), {
			status: 502,
		})
		await route(makeContext(POSTS, {resource: 'posts'}, 'per_page=3').ctx).catch(() => undefined)

		t.assert.deepEqual(urls(), [
			'https://olafmessenger.com/wp-json/wp/v2/posts?per_page=2',
			'https://olafmessenger.com/wp-json/wp/v2/posts?per_page=3',
		])
	})

	await t.test('asks the paper again once the failure is forgotten', async (t: TestContext) => {
		let route = makeWordpressRoute({failureMemory: 20})
		let down = answerWith(t, () => Promise.resolve(new Response('down', {status: 503})))
		await route(makeContext(POSTS, {resource: 'posts'}, 'per_page=2').ctx).catch(() => undefined)
		down.restore()

		await new Promise((resolve) => setTimeout(resolve, 40))
		answerWith(t, () => Promise.resolve(json([{id: 1}])))
		let {ctx, raw} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')
		await route(ctx)

		t.assert.equal(String(raw.body), '[{"id":1}]')
	})
})

/// The route behind the server's own response cache, as the app reaches it, with the paper
/// answering `upstream()`. Requests to the test server itself go through the real fetch.
async function serveThroughCache(t: TestContext, upstream: {answer: () => Promise<Response>}) {
	let realFetch = globalThis.fetch
	let upstreamUrls: string[] = []
	let fetch = mock.method(globalThis, 'fetch', (input: Request | string, init?: RequestInit) => {
		let url = input instanceof Request ? input.url : input
		if (url.startsWith('http://localhost')) return realFetch(input, init)
		upstreamUrls.push(url)
		return upstream.answer()
	})

	// each entry with the life it was stored for, which the cache reports as all of it left
	let store = new Map<string, {value: CacheObject; maxAge: number}>()
	let app = ctxCacheControl(new Koa())
	app.use(
		cachable({
			get: (key) => store.get(key)?.value,
			set: (key, value, maxAge = 0) =>
				value ? store.set(key, {value, maxAge}) : store.delete(key),
			expiresIn: (key) => store.get(key)?.maxAge,
			storedHeaders: STORED_HEADERS,
			statusName: 'ccc-server',
		}),
	)
	let router = new Router<RouterState, ContextState>({prefix: '/v1'})
	let route = makeWordpressRoute()
	router.get('/news/mess/wp/v2/:resource', route)
	router.get('/news/mess/wp/v2/:resource/:id', route)
	app.use(router.routes())

	let server = app.listen(0)
	t.after(() => {
		fetch.mock.restore()
		server.closeAllConnections()
		server.close()
	})
	await new Promise((resolve) => server.once('listening', resolve))
	let {port} = server.address() as AddressInfo
	return {
		get: (path: string) => realFetch(`http://localhost:${String(port)}${path}`),
		/** How many times the paper was asked. */
		upstreamCalls: () => upstreamUrls.length,
		/** What the paper was asked for, in order. */
		upstreamUrls: () => upstreamUrls,
		/** Forgets every cached response, as if each had expired. */
		expireAll: () => {
			store.clear()
		},
	}
}

void test('wordpress, behind the response cache', async (t) => {
	await t.test(
		'answers the paper’s JSON as it came, fetched and cached',
		async (t: TestContext) => {
			let {get} = await serveThroughCache(t, {
				answer: () => Promise.resolve(json([{id: 1}], {headers: {'x-wp-totalpages': '2'}})),
			})

			for (let attempt of ['fetched', 'cached']) {
				// eslint-disable-next-line no-await-in-loop
				let response = await get('/v1/news/mess/wp/v2/posts?per_page=1')
				t.assert.match(response.headers.get('content-type') ?? '', /application\/json/u, attempt)
				// eslint-disable-next-line no-await-in-loop
				t.assert.deepEqual(await response.json(), [{id: 1}], attempt)
				t.assert.ok(response.headers.get('link')?.includes('rel="next"'), attempt)
			}
		},
	)

	await t.test(
		'tells phones to keep a last good copy only briefly, on every hit too',
		async (t: TestContext) => {
			let upstream = {answer: () => Promise.resolve(json([{id: 1, name: 'News'}]))}
			let {get, expireAll} = await serveThroughCache(t, upstream)
			let path = '/v1/news/mess/wp/v2/categories?per_page=100'
			await get(path)
			expireAll()

			upstream.answer = () => Promise.resolve(new Response('down', {status: 503}))
			for (let attempt of ['the stale copy', 'a hit on it']) {
				// eslint-disable-next-line no-await-in-loop
				let response = await get(path)
				// eslint-disable-next-line no-await-in-loop
				t.assert.deepEqual(await response.json(), [{id: 1, name: 'News'}], attempt)
				t.assert.equal(response.headers.get('cache-control'), 'public, max-age=60', attempt)
				t.assert.match(response.headers.get('cache-status') ?? '', /; detail=stale$/u, attempt)
			}
		},
	)

	await t.test('says nothing of staleness on a fresh copy', async (t: TestContext) => {
		let {get} = await serveThroughCache(t, {answer: () => Promise.resolve(json([{id: 1}]))})
		let path = '/v1/news/mess/wp/v2/categories?per_page=100'

		for (let attempt of ['fetched', 'cached']) {
			// eslint-disable-next-line no-await-in-loop
			let response = await get(path)
			t.assert.doesNotMatch(response.headers.get('cache-status') ?? '', /stale/u, attempt)
		}
	})

	await t.test(
		'passes a reordered, percent-encoded query to the paper as it came',
		async (t: TestContext) => {
			let {get, upstreamUrls} = await serveThroughCache(t, {
				answer: () => Promise.resolve(json([{id: 1}])),
			})
			let query = '%70age=2&_fields=id%2Cdate&per_page=2'

			let response = await get(`/v1/news/mess/wp/v2/posts?${query}`)

			t.assert.equal(response.status, 200)
			t.assert.deepEqual(upstreamUrls(), [`https://olafmessenger.com/wp-json/wp/v2/posts?${query}`])
		},
	)

	await t.test(
		'serves a cached copy without asking the paper, saying how long it has left',
		async (t: TestContext) => {
			let {get, upstreamCalls} = await serveThroughCache(t, {
				answer: () => Promise.resolve(json([{id: 1, name: 'News'}])),
			})
			let path = '/v1/news/mess/wp/v2/categories?per_page=100'

			await get(path)
			let hit = await get(path)

			t.assert.equal(upstreamCalls(), 1)
			t.assert.deepEqual(await hit.json(), [{id: 1, name: 'News'}])
			t.assert.equal(hit.headers.get('cache-control'), 'public, max-age=86400')
		},
	)
})
