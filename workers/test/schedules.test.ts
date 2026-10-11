import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {resolveScheduleResponses} from '../../source/schedules/resolve.ts'
import {clock} from '../src/clock.ts'
import {STOLAF_SCHEDULES} from '../src/pages-routes.ts'
import {schedules} from '../src/sources/schedules.ts'
import {spyOnFetch} from './spy.ts'
import calendar from '../../source/schedules/fixtures/calendar.json?raw'
import calendarResponse from '../../source/schedules/fixtures/calendar-response.json?raw'
import spaces from '../../source/schedules/fixtures/spaces.json?raw'
import spacesResolved from '../../source/schedules/fixtures/spaces-resolved.json?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const json = (body: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': 'application/json'}})

// the files as they are published: each in an envelope
const HOURS_FILE = `{"data": ${spaces}}`
const BREAKS_FILE = `{"data": ${calendar}}`

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

const answer = (url: string) =>
	url === STOLAF_SCHEDULES.hoursUrl
		? json(HOURS_FILE)
		: url === STOLAF_SCHEDULES.breaksUrl
			? json(BREAKS_FILE)
			: json('{}', 404)

// storage is not reset between tests, so each starts by emptying the pair
beforeEach(async () => {
	clock.now = () => Date.parse('2030-01-15T18:00:00Z')
	await env.SOURCE.getByName(`${schedules.name}:${schedules.key(STOLAF_SCHEDULES)}`).purge()
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation((input) => Promise.resolve(answer(String(input))))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const fetched = () => fetchSpy.mock.calls.map(([input]) => String(input))

describe('GET /edu.stolaf/spaces/hours', () => {
	test('is each building with its break schedules expanded, as the Node server answers', async () => {
		let response = await get('/edu.stolaf/spaces/hours')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body = await response.json()
		expect(body).toEqual(JSON.parse(spacesResolved))
		expect(body).toEqual(resolveScheduleResponses(JSON.parse(calendar), JSON.parse(spaces)).hours)
	})

	test('a break schedule named by a template is the template, not its name', async () => {
		let body = await (
			await get('/edu.stolaf/spaces/hours')
		).json<{
			data: {breakSchedule?: Record<string, unknown>}[]
		}>()
		let schedules = body.data.flatMap(({breakSchedule = {}}) => Object.values(breakSchedule))
		expect(schedules.length).toBeGreaterThan(0)
		expect(schedules.every((schedule) => typeof schedule === 'object')).toBe(true)
	})

	test('reads both files once, for both routes', async () => {
		await get('/edu.stolaf/spaces/hours')
		await get('/edu.stolaf/breaks')
		await get('/edu.stolaf/spaces/hours')
		expect(fetched().toSorted()).toEqual(
			[STOLAF_SCHEDULES.breaksUrl, STOLAF_SCHEDULES.hoursUrl].toSorted(),
		)
	})

	test('either file failing with nothing stored is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation((input) =>
			Promise.resolve(
				String(input) === STOLAF_SCHEDULES.breaksUrl ? json('boom', 503) : answer(String(input)),
			),
		)
		let response = await get('/edu.stolaf/spaces/hours')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})

	test('a file that is not the published envelope is a 502', async () => {
		fetchSpy.mockImplementation((input) =>
			Promise.resolve(
				String(input) === STOLAF_SCHEDULES.hoursUrl
					? new Response('<html>Just a moment</html>')
					: answer(String(input)),
			),
		)
		expect((await get('/edu.stolaf/spaces/hours')).status).toBe(502)
	})

	test('hours naming a break the calendar does not have are a 502, not served unresolved', async () => {
		fetchSpy.mockImplementation((input) =>
			Promise.resolve(
				String(input) === STOLAF_SCHEDULES.breaksUrl
					? json(JSON.stringify({data: {timezone: 'America/Chicago', breaks: {}}}))
					: answer(String(input)),
			),
		)
		expect((await get('/edu.stolaf/spaces/hours')).status).toBe(502)
	})

	test('a redirect is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 301, headers: {location: 'https://example.com/'}}),
			),
		)
		expect((await get('/edu.stolaf/spaces/hours')).status).toBe(502)
		expect(fetched()).not.toContain('https://example.com/')
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})

	test("during a break, a building's break schedule is its schedule", async () => {
		clock.now = () => Date.parse('2026-10-11T18:00:00Z')
		let body = await (
			await get('/edu.stolaf/spaces/hours')
		).json<{
			data: {
				name: string
				schedule: unknown
				exceptions: unknown
				breakSchedule: Record<string, {schedule: unknown; exceptions: unknown}>
			}[]
		}>()
		for (let space of body.data) {
			expect(space.schedule).toEqual(space.breakSchedule['fall']?.schedule)
			expect(space.exceptions).toEqual(space.breakSchedule['fall']?.exceptions)
		}
	})

	test('is not kept past campus midnight', async () => {
		// 11:55 PM in Northfield
		clock.now = () => Date.parse('2026-10-11T04:55:00Z')
		let response = await get('/edu.stolaf/spaces/hours')
		expect(response.headers.get('cache-control')).toBe('public, max-age=300')
	})

	test('?date= is that campus date, not today', async () => {
		clock.now = () => Date.parse('2026-10-11T18:00:00Z')
		let after = await get('/edu.stolaf/spaces/hours?date=2026-11-01')
		expect(after.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await after.json()).toEqual(JSON.parse(spacesResolved))
		expect((await get('/edu.stolaf/spaces/hours?date=2026-13-01')).status).toBe(400)
	})

	test('only the published files are fetched', async () => {
		let source = schedules as unknown as {
			load: (p: {hoursUrl: string; breaksUrl: string}) => Promise<unknown>
		}
		await expect(
			source.load({hoursUrl: 'https://example.com/h.json', breaksUrl: STOLAF_SCHEDULES.breaksUrl}),
		).rejects.toThrow('is not a schedule file this reads')
		expect(fetched()).not.toContain('https://example.com/h.json')
	})
})

describe('GET /edu.stolaf/breaks', () => {
	test('is the break calendar without its templates, as the Node server answers', async () => {
		let response = await get('/edu.stolaf/breaks')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual(JSON.parse(calendarResponse))
	})
})

describe('Carleton', () => {
	test('/spaces/hours is a redirect to its published file, and there is no /breaks', async () => {
		let response = await exports.default.fetch(
			new Request('https://worker.test/edu.carleton/spaces/hours', {redirect: 'manual'}),
		)
		expect(response.status).toBe(307)
		expect(response.headers.get('location')).toBe(
			'https://carls-app.github.io/carls/building-hours.json',
		)
		expect((await get('/edu.carleton/breaks')).status).toBe(404)
	})
})
