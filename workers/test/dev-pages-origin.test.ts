import {env} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import wranglerConfig from '../../wrangler.jsonc?raw'
import {STOLAF_PUBLISHED, devPagesOrigin, rebased} from '../src/pages-origin.ts'
import {STOLAF_SCHEDULES} from '../src/pages-routes.ts'
import {route} from '../src/router.ts'
import {schedules} from '../src/sources/schedules.ts'
import {spyOnFetch} from './spy.ts'
import calendar from '../../source/schedules/fixtures/calendar.json?raw'
import spaces from '../../source/schedules/fixtures/spaces.json?raw'

const ORIGIN = 'http://editor-mac.local:8790/'

/// The test worker's bindings with the dev origin added, everything else
/// unchanged. Defined rather than assigned: assigning through the bindings'
/// prototype would set the var on the shared `env` itself.
const withOrigin = Object.create(env, {PAGES_ORIGIN_OVERRIDE: {value: ORIGIN}}) as Env

const get = (path: string, bindings: Env = withOrigin) =>
	route(new Request(`https://worker.test${path}`), bindings)

describe('devPagesOrigin', () => {
	test.each([undefined, '', 'not a url', 'file:///Users/someone/out/'])(
		'is undefined for %j',
		(value) => {
			expect(devPagesOrigin({PAGES_ORIGIN_OVERRIDE: value})).toBeUndefined()
		},
	)
	test('ends the origin with a slash', () => {
		expect(devPagesOrigin({PAGES_ORIGIN_OVERRIDE: 'http://editor-mac.local:8790'})).toBe(ORIGIN)
	})
})

describe('rebased', () => {
	test('moves a St. Olaf published file onto the origin', () => {
		expect(rebased(`${STOLAF_PUBLISHED}bus-times.json`, ORIGIN)).toBe(`${ORIGIN}bus-times.json`)
	})
	test.each([
		'https://carls-app.github.io/carls/bus-times.json',
		'https://stolaf.dev/course-data/catalog-recent.db',
	])('leaves %s alone', (url) => {
		expect(rebased(url, ORIGIN)).toBe(url)
	})
	test('leaves everything alone without an origin', () => {
		expect(rebased(`${STOLAF_PUBLISHED}bus-times.json`, undefined)).toBe(
			`${STOLAF_PUBLISHED}bus-times.json`,
		)
	})
	test('names the prefix the route table publishes under', () => {
		expect(STOLAF_SCHEDULES.hoursUrl.startsWith(STOLAF_PUBLISHED)).toBe(true)
	})
})

describe('redirects with a dev origin', () => {
	test.each([
		['/edu.stolaf/transit/bus', `${ORIGIN}bus-times.json`],
		['/edu.stolaf/contacts', `${ORIGIN}contact-info.json`],
		['/edu.stolaf/images/spaces/the-cage.webp', `${ORIGIN}img/spaces/the-cage.webp`],
		['/edu.stolaf/courses/catalog.db', 'https://stolaf.dev/course-data/catalog-recent.db'],
	])('GET %s goes to %s', async (path, location) => {
		let response = await get(path)
		expect(response.status).toBe(307)
		expect(response.headers.get('Location')).toBe(location)
	})
	test('without one, the published file', async () => {
		let response = await get('/edu.stolaf/transit/bus', env)
		expect(response.headers.get('Location')).toBe(`${STOLAF_PUBLISHED}bus-times.json`)
	})
	test('wrangler.jsonc never sets the override', () => {
		expect(wranglerConfig).not.toContain('PAGES_ORIGIN_OVERRIDE')
	})
})

const json = (body: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': 'application/json'}})

describe('GET /edu.stolaf/spaces/hours with a dev origin', () => {
	let fetchSpy: MockInstance<typeof fetch>
	const fromOrigin = () =>
		fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url.startsWith(ORIGIN))

	beforeEach(async () => {
		await env.SOURCE.getByName(`${schedules.name}:${schedules.key(STOLAF_SCHEDULES)}`).purge()
		fetchSpy = spyOnFetch()
		fetchSpy.mockImplementation((input) => {
			let url = String(input)
			if (url.endsWith('/building-hours.json')) return Promise.resolve(json(`{"data": ${spaces}}`))
			if (url.endsWith('/breaks.json')) return Promise.resolve(json(`{"data": ${calendar}}`))
			return Promise.resolve(json('{}', 404))
		})
	})
	afterEach(() => {
		fetchSpy.mockRestore()
	})

	test('reads both files from the origin', async () => {
		let response = await get('/edu.stolaf/spaces/hours?breaks=none')
		expect(response.status).toBe(200)
		expect(fromOrigin().sort()).toEqual([`${ORIGIN}breaks.json`, `${ORIGIN}building-hours.json`])
	})

	test('answers as the published files would', async () => {
		let local: unknown = await (await get('/edu.stolaf/spaces/hours?breaks=none')).json()
		let published: unknown = await (await get('/edu.stolaf/spaces/hours?breaks=none', env)).json()
		expect(local).toEqual(published)
	})

	test('reads them again for every request', async () => {
		await get('/edu.stolaf/spaces/hours?breaks=none')
		await get('/edu.stolaf/breaks')
		expect(fromOrigin()).toHaveLength(4)
	})
})
