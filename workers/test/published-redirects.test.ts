import {exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {GH_PAGES as CARLETON_PAGES} from '../../source/ccci-carleton-college/v1/gh-pages.ts'
import {
	GH_PAGES as STOLAF_PAGES,
	GH_PAGES_FROM_REPO,
} from '../../source/ccci-stolaf-college/v1/gh-pages.ts'
import {imageUrl} from '../../source/ccc-lib/images-shape.ts'
import {deprecatedLinkGroups} from '../../source/ccci-stolaf-college/v1/deprecated-shape.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string, init?: RequestInit) =>
	exports.default.fetch(new Request(`https://worker.test${path}`, init))

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
	fetchSpy = spyOnFetch()
	fetchSpy.mockImplementation(() => Promise.reject(new Error('nothing is fetched')))
})
afterEach(() => {
	fetchSpy.mockRestore()
})

// each path, and the file the Node server's route reads for it
const redirects: [string, string][] = [
	['/edu.stolaf/transit/bus', STOLAF_PAGES('bus-times.json').href],
	['/edu.stolaf/transit/modes', STOLAF_PAGES('transportation.json').href],
	['/edu.stolaf/printing/color-printers', STOLAF_PAGES('color-printers.json').href],
	['/edu.stolaf/reports/stav', GH_PAGES_FROM_REPO('stav-mealtimes', 'two-weeks.json').href],
	['/edu.stolaf/food/named/menu/the-pause', STOLAF_PAGES('pause-menu.json').href],
	['/edu.stolaf/courses/catalog.db', 'https://stolaf.dev/course-data/catalog-recent.db'],
	['/edu.carleton/transit/bus', CARLETON_PAGES('bus-times.json').href],
	['/edu.carleton/transit/modes', CARLETON_PAGES('transportation.json').href],
	['/edu.carleton/food/named/menu/the-pause', CARLETON_PAGES('pause-menu.json').href],
	['/edu.stolaf/images/spaces/the-cage.webp', imageUrl('spaces', 'the-cage.webp').href],
	['/edu.carleton/images/webcams/sayles.webp', imageUrl('webcams', 'sayles.webp').href],
]

describe.each(redirects)('GET %s', (path, location) => {
	test('is a temporary redirect to the file the Node route reads, kept ten minutes', async () => {
		let response = await get(path, {redirect: 'manual'})
		expect(response.status).toBe(307)
		expect(response.headers.get('location')).toBe(location)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(fetchSpy).not.toHaveBeenCalled()
	})
})

describe('GET /images/:group/:name', () => {
	test('a group or name the app does not publish is a 404', async () => {
		for (let path of [
			'/edu.stolaf/images/secrets/x.webp',
			'/edu.stolaf/images/spaces/x.png',
			'/edu.stolaf/images/spaces/..%2Findex.html',
			'/edu.stolaf/images/toString/x.webp',
		]) {
			expect((await get(path)).status, path).toBe(404)
		}
	})

	test('a query string is a 404, as on the Node server', async () => {
		expect((await get('/edu.stolaf/images/spaces/the-cage.webp?1')).status).toBe(404)
	})
})

describe('GET /edu.stolaf/a-to-z', () => {
	test('is the Node route’s notice, with nothing fetched', async () => {
		let response = await get('/edu.stolaf/a-to-z')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual(
			deprecatedLinkGroups("The A–Z index can't be loaded right now. Tap for details."),
		)
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('reads the same at any time, so a re-check is a 304', async () => {
		let tag = (await get('/edu.stolaf/a-to-z')).headers.get('etag') ?? ''
		let again = await get('/edu.stolaf/a-to-z', {headers: {'If-None-Match': tag}})
		expect(again.status).toBe(304)
	})
})

describe('the route tables', () => {
	test('a path only one campus lists is a 404 on the other', async () => {
		for (let path of [
			'/edu.carleton/a-to-z',
			'/edu.carleton/printing/color-printers',
			'/edu.carleton/reports/stav',
			'/edu.carleton/courses/catalog.db',
		]) {
			expect((await get(path)).status, path).toBe(404)
		}
	})
})
