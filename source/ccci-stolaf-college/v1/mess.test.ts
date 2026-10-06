import {test, mock, type TestContext} from 'node:test'
import QuickLRU from 'quick-lru'

import {makeWordpressRoute, paginationLinks, rulesFor, withPage, type Answer} from './mess.ts'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

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
			['media', undefined, 'include=4,5&per_page=100&_fields=id,source_url,media_details,caption'],
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

	await t.test('caches each resource for its own time', (t: TestContext) => {
		let ttl = (resource: string, id?: string) => {
			let verdict = rulesFor(resource, id, query(''))
			return 'rules' in verdict ? verdict.rules.ttl : undefined
		}
		t.assert.equal(ttl('posts'), 5 * ONE_MINUTE)
		t.assert.equal(ttl('posts', '1'), ONE_HOUR)
		for (let resource of ['categories', 'media', 'staff_profile', 'staff_year', 'pages']) {
			t.assert.equal(ttl(resource), ONE_DAY)
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
			]) {
				let verdict = rulesFor('posts', undefined, query(querystring))
				t.assert.ok('refusal' in verdict && verdict.refusal.status === 400, querystring)
			}
			let slug = rulesFor('pages', undefined, query('slug=../about'))
			t.assert.ok('refusal' in slug && slug.refusal.status === 400)
		},
	)

	await t.test('checks the decoded values of an encoded query string', (t: TestContext) => {
		t.assert.ok('rules' in rulesFor('posts', undefined, query('_fields=id%2Cdate&per_page=2')))
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
		cacheControl: mock.fn((_maxAge: number) => undefined),
		setCacheTTL: mock.fn((_maxAge: number) => undefined),
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

const newStore = () => new QuickLRU<string, Answer>({maxSize: 10})
const POSTS = '/v1/news/mess/wp/v2/posts'

void test('wordpress', async (t) => {
	await t.test(
		'passes a list through with its paging headers, and links its pages',
		async (t: TestContext) => {
			let {urls} = answerWith(t, () =>
				Promise.resolve(json([{id: 1}], {headers: {'x-wp-total': '9', 'x-wp-totalpages': '5'}})),
			)
			let {ctx, raw, headers} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2&page=2')

			await makeWordpressRoute(newStore())(ctx)

			t.assert.deepEqual(urls(), [
				'https://olafmessenger.com/wp-json/wp/v2/posts?per_page=2&page=2',
			])
			t.assert.equal(raw.status, 200)
			t.assert.equal(raw.body, '[{"id":1}]')
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

		await makeWordpressRoute(newStore())(ctx)

		t.assert.deepEqual(urls(), ['https://olafmessenger.com/wp-json/wp/v2/posts/36238?_embed=true'])
		t.assert.equal(raw.body, '{"id":36238}')
		t.assert.equal(headers.has('link'), false)
		t.assert.deepEqual(raw.cached.mock.calls[0]?.arguments, [ONE_HOUR])
	})

	await t.test('serves a cached copy without asking the paper', async (t: TestContext) => {
		let {urls} = answerWith(t, () => Promise.resolve(json([])))
		let {ctx, raw} = makeContext(
			'/v1/news/mess/wp/v2/categories',
			{resource: 'categories'},
			'per_page=100',
		)
		raw.cached = mock.fn((_maxAge?: number) => true)

		await makeWordpressRoute(newStore())(ctx)

		t.assert.deepEqual(urls(), [])
		t.assert.deepEqual(raw.cacheControl.mock.calls[0]?.arguments, [ONE_DAY])
	})

	await t.test(
		"passes WordPress's 400 for a page past the last through, uncached",
		async (t: TestContext) => {
			answerWith(t, () =>
				Promise.resolve(json({code: 'rest_post_invalid_page_number'}, {status: 400})),
			)
			let {ctx, raw} = makeContext(POSTS, {resource: 'posts'}, 'per_page=50&page=9999')

			await makeWordpressRoute(newStore())(ctx)

			t.assert.equal(raw.status, 400)
			t.assert.equal(raw.body, '{"code":"rest_post_invalid_page_number"}')
			t.assert.equal(raw.cacheControl.mock.callCount(), 0)
		},
	)

	await t.test(
		'refuses a request outside the allowlist without asking the paper',
		async (t: TestContext) => {
			let {urls} = answerWith(t, () => Promise.resolve(json([])))
			let {ctx} = makeContext('/v1/news/mess/wp/v2/users', {resource: 'users'})

			await t.assert.rejects(makeWordpressRoute(newStore())(ctx), {status: 404})
			t.assert.deepEqual(urls(), [])
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
	]
	for (let [failure, response] of failures) {
		// each failure's subtests share no state, but node:test runs them one at a time anyway
		// eslint-disable-next-line no-await-in-loop
		await t.test(`serves the last good copy on ${failure}, briefly`, async (t: TestContext) => {
			let route = makeWordpressRoute(newStore())

			let good = answerWith(t, () =>
				Promise.resolve(json([{id: 1}], {headers: {'x-wp-totalpages': '3'}})),
			)
			await route(makeContext(POSTS, {resource: 'posts'}, 'per_page=2').ctx)
			good.restore()

			answerWith(t, response)
			let {ctx, raw, headers} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')
			await route(ctx)

			t.assert.equal(raw.status, 200)
			t.assert.equal(raw.body, '[{"id":1}]')
			t.assert.equal(headers.get('x-wp-totalpages'), '3')
			t.assert.ok(headers.get('link')?.includes('rel="next"'))
			t.assert.deepEqual(raw.setCacheTTL.mock.calls[0]?.arguments, [ONE_MINUTE])
			t.assert.deepEqual(raw.cacheControl.mock.calls.at(-1)?.arguments, [ONE_MINUTE])
		})

		// eslint-disable-next-line no-await-in-loop
		await t.test(`is a 502 on ${failure} with no copy to serve`, async (t: TestContext) => {
			answerWith(t, response)
			let {ctx} = makeContext(POSTS, {resource: 'posts'}, 'per_page=2')

			await t.assert.rejects(makeWordpressRoute(newStore())(ctx), {status: 502})
		})
	}
})
