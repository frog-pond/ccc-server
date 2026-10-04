import {test, mock, type TestContext} from 'node:test'
import {noop} from 'lodash-es'

import {image, imageUrl, isPublishedImage} from './images.ts'
import type {Context} from '../ccc-server/context.ts'

void test('isPublishedImage', (t: TestContext) => {
	t.assert.ok(isPublishedImage('spaces', 'old-main.webp'))
	t.assert.ok(isPublishedImage('news-sources', 'stolaf.webp'))
	t.assert.ok(isPublishedImage('streaming', 'ksto-wordmark.webp'))

	// the rest of the Pages site is not ours to serve
	t.assert.ok(!isPublishedImage('', 'contact-info.webp'))
	t.assert.ok(!isPublishedImage('data', 'contact-info.webp'))
	// nothing but a plain WebP file name gets through
	t.assert.ok(!isPublishedImage('spaces', '..%2Fcontact-info.json'))
	t.assert.ok(!isPublishedImage('spaces', '../webcams.webp'))
	t.assert.ok(!isPublishedImage('spaces', 'old-main.jpg'))
	t.assert.ok(!isPublishedImage('spaces', 'Old-Main.webp'))
})

void test('imageUrl points at the Pages site under img/', (t: TestContext) => {
	t.assert.equal(
		imageUrl('contacts', 'sarn.webp').href,
		'https://stodevx.github.io/AAO-React-Native/img/contacts/sarn.webp',
	)
})

const makeContext = (group: string, name: string) =>
	({
		params: {group, name},
		cacheControl: noop,
		cached: () => false,
		throw: (status: number, message: string) => {
			throw new Error(`${status.toFixed(0)}: ${message}`)
		},
		status: 200,
		type: '',
		body: null,
	}) as unknown as Context

void test('image', async (t) => {
	await t.test('proxies the file from Pages as image/webp', async (t: TestContext) => {
		const fetch = mock.method(globalThis, 'fetch', () =>
			Promise.resolve(new Response(new Uint8Array([82, 73, 70, 70]))),
		)
		t.after(() => {
			fetch.mock.restore()
		})

		const ctx = makeContext('webcams', 'madson.webp')
		await image(ctx)

		t.assert.equal(ctx.type, 'image/webp')
		t.assert.deepEqual(ctx.body, Buffer.from([82, 73, 70, 70]))
		const [request] = fetch.mock.calls[0]?.arguments as [Request]
		t.assert.equal(
			request.url,
			'https://stodevx.github.io/AAO-React-Native/img/webcams/madson.webp',
		)
	})

	await t.test('is a 404 for an image Pages does not have', async (t: TestContext) => {
		const fetch = mock.method(globalThis, 'fetch', () =>
			Promise.resolve(new Response('not found', {status: 404})),
		)
		t.after(() => {
			fetch.mock.restore()
		})

		const ctx = makeContext('spaces', 'nowhere.webp')
		await image(ctx)

		t.assert.equal(ctx.status, 404)
		t.assert.equal(ctx.body, null)
	})

	await t.test(
		'is a 404 without asking Pages for a name it does not publish',
		async (t: TestContext) => {
			const fetch = mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('')))
			t.after(() => {
				fetch.mock.restore()
			})

			const ctx = makeContext('data', 'contact-info.webp')
			await image(ctx)

			t.assert.equal(ctx.status, 404)
			t.assert.equal(fetch.mock.callCount(), 0)
		},
	)

	await t.test('is a 502 when Pages itself fails', async (t: TestContext) => {
		const fetch = mock.method(globalThis, 'fetch', () =>
			Promise.resolve(new Response('', {status: 503})),
		)
		t.after(() => {
			fetch.mock.restore()
		})

		await t.assert.rejects(image(makeContext('spaces', 'boe.webp')), /502/u)
	})
})
