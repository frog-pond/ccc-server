import {env} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import wranglerConfig from '../../wrangler.jsonc?raw'
import {STOLAF_PUBLISHED, devPagesOrigin, rebased} from '../src/pages-origin.ts'
import {STOLAF_SCHEDULES} from '../src/pages-routes.ts'
import {route} from '../src/router.ts'
import {loadSchedules, schedules} from '../src/sources/schedules.ts'
import {spyOnFetch} from './spy.ts'
import calendar from '../../source/schedules/fixtures/calendar.json?raw'
import spaces from '../../source/schedules/fixtures/spaces.json?raw'

const ORIGIN = 'http://editor-mac.local:8790/'

/// The test worker's bindings with the dev origin added, everything else
/// unchanged. A copy, so the shared `env` never gets the var.
const withOrigin: Env = {...env, PAGES_ORIGIN_OVERRIDE: ORIGIN}

const get = (path: string, bindings: Env = withOrigin) =>
	route(new Request(`https://worker.test${path}`), bindings)

describe('devPagesOrigin', () => {
	test.each([undefined, '', 'not a url', 'file:///Users/someone/out/'])(
		'is undefined for %j',
		(value) => {
			expect(devPagesOrigin({PAGES_ORIGIN_OVERRIDE: value})).toBeUndefined()
		},
	)
	test.each([
		['http://editor-mac.local:8790/?x=1', ORIGIN],
		['http://editor-mac.local:8790/#top', ORIGIN],
		['http://editor-mac.local:8790/out?x=1#top', 'http://editor-mac.local:8790/out/'],
	])('keeps only the origin and path of %s', (value, origin) => {
		expect(devPagesOrigin({PAGES_ORIGIN_OVERRIDE: value})).toBe(origin)
	})
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
	test('is never kept, so a rebuilt file is fetched again', async () => {
		let response = await get('/edu.stolaf/transit/bus')
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})
	test('no route is kept, so a dev session never sees an old answer', async () => {
		let response = await get('/edu.stolaf/routes')
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		let published = await get('/edu.stolaf/routes', env)
		expect(published.headers.get('Cache-Control')).toMatch(/^public, max-age=/)
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

	test('answers with responses nothing keeps', async () => {
		for (let path of [
			'/edu.stolaf/spaces/hours',
			'/edu.stolaf/spaces/hours?breaks=none',
			'/edu.stolaf/breaks',
		]) {
			let response = await get(path)
			expect(response.status, path).toBe(200)
			expect(response.headers.get('Cache-Control'), path).toBe('no-store')
		}
	})

	test('answers a file that is not JSON with a 502 nothing keeps', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(json('{"data": [ half a fil')))
		let response = await get('/edu.stolaf/spaces/hours')
		expect(response.status).toBe(502)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})

	test('refuses a file outside the origin, however its path is written', async () => {
		let origin = 'http://editor-mac.local:8790/out/'
		let params = {
			hoursUrl: 'http://editor-mac.local:8790/out/../secret/building-hours.json',
			breaksUrl: `${origin}breaks.json`,
		}
		await expect(loadSchedules(params, origin)).rejects.toThrow(/not a schedule file/)
		expect(fetchSpy).not.toHaveBeenCalledWith(params.hoursUrl, expect.anything())
	})

	test('refuses a file on another host', async () => {
		let params = {
			hoursUrl: 'http://elsewhere.local/building-hours.json',
			breaksUrl: `${ORIGIN}breaks.json`,
		}
		await expect(loadSchedules(params, ORIGIN)).rejects.toThrow(/not a schedule file/)
	})

	test('does not keep a failure either', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(json('{}', 404)))
		let response = await get('/edu.stolaf/spaces/hours')
		expect(response.status).toBe(502)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})

	test('reads them again for every request', async () => {
		await get('/edu.stolaf/spaces/hours?breaks=none')
		await get('/edu.stolaf/breaks')
		expect(fromOrigin()).toHaveLength(4)
	})
})

describe('other files the Worker reads itself, with a dev origin', () => {
	let fetchSpy: MockInstance<typeof fetch>
	const fetched = () => fetchSpy.mock.calls.map(([input]) => String(input))

	beforeEach(() => {
		fetchSpy = spyOnFetch()
		fetchSpy.mockImplementation(() => Promise.resolve(json('{}', 404)))
	})
	afterEach(() => {
		fetchSpy.mockRestore()
	})

	test("KSTO's weekly schedule comes from the origin", async () => {
		await get('/edu.stolaf/calendar/ksto-schedule')
		expect(fetched()).toContain(`${ORIGIN}ksto-schedule.json`)
		expect(fetched().filter((url) => url.startsWith(STOLAF_PUBLISHED))).toEqual([])
	})

	test('the Student Work areas come from the origin', async () => {
		await get('/edu.stolaf/student-work/postings?area=dining')
		expect(fetched()).toContain(`${ORIGIN}student-work-areas.json`)
		expect(fetched().filter((url) => url.startsWith(STOLAF_PUBLISHED))).toEqual([])
	})
})
