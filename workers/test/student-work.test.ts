import {env, exports} from 'cloudflare:workers'
import {runDurableObjectAlarm, runInDurableObject} from 'cloudflare:test'
import {afterEach, beforeEach, describe, expect, test, type MockInstance} from 'vitest'
import {groupUnits, listedUnitsOf} from '../../source/student-work/areas.ts'
import {readDescription} from '../../source/student-work/posting-shape.ts'
import {clock} from '../src/clock.ts'
import {STOLAF_FILES} from '../src/pages-routes.ts'
import {DETAILS_PER_RUN, JITTER, REFRESH_EVERY} from '../src/student-work-do.ts'
import {studentWorkAreas} from '../src/student-work.ts'
import {spyOnFetch} from './spy.ts'
import standard from '../../source/student-work/fixtures/detail-standard.json?raw'
import summer from '../../source/student-work/fixtures/detail-summer.json?raw'
import unitNa from '../../source/student-work/fixtures/detail-unit-na.json?raw'
import romanNumerals from '../../source/student-work/fixtures/detail-roman-numerals.json?raw'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const ORACLE = 'https://fa-ewur-saasfaprod1.fa.ocs.oraclecloud.com'
const BOARD = `${ORACLE}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`
const DETAIL = `${ORACLE}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`
const AREAS_URL = STOLAF_FILES['/student-work/areas']!.url

type Detail = {items: [{Id: string; Title: string; ExternalDescriptionStr: string}]}

/// Each fixture's posting, by its id.
const DETAILS = new Map(
	[standard, summer, unitNa, romanNumerals].map((raw) => {
		let body = JSON.parse(raw.replaceAll('2026', '2030')) as Detail
		return [body.items[0].Id, body] as const
	}),
)

type Listed = {Id: string; Title: string; PostedDate: string; PrimaryLocation: string}

const listed = (id: string, postedDate: string): Listed => ({
	Id: id,
	Title: DETAILS.get(id)?.items[0].Title ?? `Posting ${id} (WS-ST1)`,
	PostedDate: postedDate,
	PrimaryLocation: 'Northfield, MN, United States',
})

const FULL_BOARD = [
	listed('2841', '2030-10-08'),
	listed('2799', '2030-09-01'),
	listed('2903', '2030-10-01'),
	listed('2770', '2030-08-20'),
]

const AREAS = {
	data: [
		{name: 'Athletics', slug: 'athletics', icon: 'x', gradient: null, units: ['11725', '11727']},
		{name: 'Residence Life', slug: 'res-life', icon: 'x', gradient: null, units: ['15141']},
		{name: 'Other', slug: 'other', icon: 'x', gradient: null, units: ['other']},
	],
}

let board: Listed[] = FULL_BOARD
let respond: (url: URL) => Response | undefined = () => undefined
let fetchSpy: MockInstance<typeof fetch>
let now = 0

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))
const stub = () => env.STUDENT_WORK.getByName('stolaf')
const alarmAt = () => runInDurableObject(stub(), (_do, state) => state.storage.getAlarm())

const calls = (prefix: string) =>
	fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url.startsWith(prefix))
const detailCalls = () => calls(DETAIL).map((url) => /Id=(\d+)/.exec(decodeURIComponent(url))?.[1])

beforeEach(async () => {
	now = Date.parse('2030-10-10T12:00:00Z')
	clock.now = () => now
	board = FULL_BOARD
	respond = () => undefined
	await stub().purge()
	await env.SOURCE.getByName(`${studentWorkAreas.name}:${AREAS_URL}`).purge()

	fetchSpy = spyOnFetch()
	fetchSpy.mockImplementation((input) => {
		let url = new URL(String(input))
		let override = respond(url)
		if (override) return Promise.resolve(override)
		if (url.href === AREAS_URL) return Promise.resolve(Response.json(AREAS))
		if (url.href.startsWith(BOARD)) {
			return Promise.resolve(Response.json({items: [{SearchId: 1, requisitionList: board}]}))
		}
		if (url.href.startsWith(DETAIL)) {
			let id = /Id=(\d+)/.exec(decodeURIComponent(url.search))?.[1] ?? ''
			let detail = DETAILS.get(id) ?? {
				items: [{Id: id, Title: `Posting ${id}`, ExternalDescriptionStr: ''}],
			}
			return Promise.resolve(Response.json(detail))
		}
		return Promise.resolve(new Response('not found', {status: 404}))
	})
})
afterEach(() => fetchSpy.mockRestore())

type Posting = Record<string, unknown> & {id: string}
type List = {updatedAt: string; count: number; postings: Posting[]}

async function list(query = ''): Promise<List> {
	let response = await get(`/edu.stolaf/student-work/postings${query}`)
	expect(response.status).toBe(200)
	return response.json<List>()
}

const ids = (body: List) => body.postings.map((posting) => posting.id)

describe('GET /edu.stolaf/student-work/postings', () => {
	test('lists every posting, newest first, with what its title and description say', async () => {
		let response = await get('/edu.stolaf/student-work/postings')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')

		let body = await response.json<List>()
		expect(body.updatedAt).toBe(new Date(now).toISOString())
		expect(body.count).toBe(4)
		expect(ids(body)).toEqual(['2841', '2903', '2799', '2770'])

		let description = readDescription(DETAILS.get('2841')!.items[0].ExternalDescriptionStr)
		expect(body.postings[0]).toEqual({
			id: '2841',
			title: 'AY Athletic Events Student Worker (WS-ST1)',
			displayTitle: 'Athletic Events Student Worker',
			url: `${ORACLE}/hcmUI/CandidateExperience/en/sites/CX_1/job/2841`,
			postedDate: '2030-10-08',
			postedAt: expect.any(String),
			endsAt: null,
			firstSeenAt: new Date(now).toISOString(),
			location: 'Northfield, MN, United States',
			category: 'Student Work',
			schedule: expect.any(String),
			requisitionType: expect.any(String),
			workplaceType: null,
			term: 'academic-year',
			level: 'entry',
			payCode: {structure: 'ST', tier: 1},
			unit: '11725',
			areas: ['athletics'],
			department: description.promoted.department,
			wage: '$12.00-13.00/hour',
			length: description.promoted.length,
			contact: description.promoted.contact,
			classification: description.promoted.classification,
			detailUpdatedAt: new Date(now).toISOString(),
		})
		expect(body.postings[0]?.['department']).toBe('Athletics')
	})

	test('a posting whose description names no unit is in the catch-all area', async () => {
		let body = await list()
		let posting = body.postings.find((p) => p.id === '2903')
		expect(posting).toMatchObject({unit: null, areas: ['other']})
	})

	test('a second request is answered from storage, not Oracle', async () => {
		await list()
		await list()
		await get('/edu.stolaf/student-work/units')
		expect(calls(BOARD)).toHaveLength(1)
		expect(detailCalls()).toHaveLength(4)
	})

	test('reads Oracle only at its own addresses, without following redirects', async () => {
		await list()
		for (let [input, init] of fetchSpy.mock.calls) {
			let url = new URL(String(input))
			if (url.href === AREAS_URL) continue
			expect(url.origin).toBe(ORACLE)
			expect(init).toMatchObject({redirect: 'manual'})
		}
	})

	describe('filters', () => {
		test.each([
			['?area=athletics', ['2841', '2799']],
			['?area=res-life,other', ['2903', '2770']],
			['?area=res-life&area=athletics', ['2841', '2799', '2770']],
			['?unit=11725', ['2841']],
			['?unit=none', ['2903']],
			['?level=entry', ['2841', '2770']],
			['?level=lead', ['2903']],
			['?level=none', []],
			['?term=summer', ['2799']],
			['?term=academic-year', ['2841', '2903', '2770']],
			['?posted_since=2030-10-01', ['2841', '2903']],
			['?title=athletic', ['2841', '2799']],
			['?title=ATHLETIC%20events', ['2841']],
			// the term prefix and pay code are not part of the title searched
			['?title=ay', []],
			['?title=co-op', ['2903']],
			// the search reaches descriptions, and their labelled lines
			['?q=videographers', ['2841']],
			['?q=ice%20arena', ['2841']],
			['?q=game%20operations', ['2841']],
			['?q=videog', ['2841']],
			['?title=videographers', []],
			['?q=athletic&title=training', ['2799']],
			['?area=athletics&level=entry', ['2841']],
		])('%s', async (query, expected) => {
			let body = await list(query)
			expect(ids(body)).toEqual(expected)
			expect(body.count).toBe(expected.length)
		})

		test.each([
			['?nope=1', /unknown parameter nope/],
			['?level=intern', /level cannot be "intern"/],
			['?unit=123', /unit cannot be "123"/],
			['?area=Not%20A%20Slug', /area cannot be/],
			['?posted_since=yesterday', /posted_since must be YYYY-MM-DD/],
			['?posted_since=2030-01-01&posted_since=2030-02-01', /posted_since can be given once/],
			[`?q=${'a'.repeat(101)}`, /q must be at most 100 characters/],
			['?title=a&title=b', /title can be given once/],
			['?sort=oldest', /sort must be newest or relevance/],
			[`?term=${Array(21).fill('fall').join(',')}`, /too many values for term/],
		])('%s is a 400', async (query, message) => {
			let response = await get(`/edu.stolaf/student-work/postings${query}`)
			expect(response.status).toBe(400)
			expect((await response.json<{message: string}>()).message).toMatch(message)
			expect(calls(BOARD)).toHaveLength(0)
		})

		test('sort=relevance puts a title match ahead of a description match', async () => {
			let newest = ids(await list('?q=athletic'))
			let ranked = ids(await list('?q=athletic&sort=relevance'))
			expect(new Set(ranked)).toEqual(new Set(newest))
			let titled = new Set(['2841', '2799'])
			let firstOther = ranked.findIndex((id) => !titled.has(id))
			expect(ranked.slice(0, 2).every((id) => titled.has(id))).toBe(true)
			expect(firstOther === -1 || firstOther >= 2).toBe(true)
		})

		test('an area filter with the areas file down is a 502', async () => {
			respond = (url) => (url.href === AREAS_URL ? new Response('', {status: 500}) : undefined)
			let response = await get('/edu.stolaf/student-work/postings?area=athletics')
			expect(response.status).toBe(502)
		})

		test('a file that is not a list of areas is not used for areas', async () => {
			respond = (url) => (url.href === AREAS_URL ? Response.json({from: url.href}) : undefined)
			let response = await get('/edu.stolaf/student-work/postings?area=athletics')
			expect(response.status).toBe(502)
			let body = await list()
			expect(body.postings.every((posting) => (posting['areas'] as []).length === 0)).toBe(true)
		})

		test('without the areas file, postings list with no areas', async () => {
			respond = (url) => (url.href === AREAS_URL ? new Response('', {status: 500}) : undefined)
			let body = await list()
			expect(body.count).toBe(4)
			expect(body.postings.every((posting) => (posting['areas'] as []).length === 0)).toBe(true)
		})
	})

	test('with nothing stored and Oracle down, a 502 kept briefly', async () => {
		respond = (url) => (url.href.startsWith(BOARD) ? new Response('', {status: 503}) : undefined)
		let response = await get('/edu.stolaf/student-work/postings')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		let {message} = await response.json<{message: string}>()
		expect(message).toBe(`Oracle Recruiting responded 503 for ${BOARD}`)
	})

	test('a page in place of the board is a 502', async () => {
		respond = (url) =>
			url.href.startsWith(BOARD)
				? new Response('<html>Just a moment...</html>', {headers: {'content-type': 'text/html'}})
				: undefined
		expect((await get('/edu.stolaf/student-work/postings')).status).toBe(502)
	})

	test('a redirect is not followed', async () => {
		respond = (url) =>
			url.href.startsWith(BOARD)
				? new Response(null, {status: 302, headers: {location: 'https://example.com/'}})
				: undefined
		expect((await get('/edu.stolaf/student-work/postings')).status).toBe(502)
		expect(calls('https://example.com')).toHaveLength(0)
	})

	test('is not a route on a campus without the board', async () => {
		expect((await get('/edu.carleton/student-work/postings')).status).toBe(404)
		expect(calls(BOARD)).toHaveLength(0)
	})
})

describe('GET /edu.stolaf/student-work/postings/:id', () => {
	test('one posting, with its description as Markdown, fields and HTML', async () => {
		let response = await get('/edu.stolaf/student-work/postings/2841')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
		let body = await response.json<Posting & {description: Record<string, unknown>}>()

		let html = DETAILS.get('2841')!.items[0].ExternalDescriptionStr
		expect(body).toMatchObject({id: '2841', unit: '11725', areas: ['athletics']})
		expect(body.description).toEqual({...readDescription(html), html})
		expect(body.description['markdown']).toContain('**Duties and Responsibilities:**')
		expect(body.description['markdown']).not.toContain('Wage Range')
		expect(body.description['markdown']).not.toContain('Unit Number')
		expect(body.description['fields']).toContainEqual({
			label: 'Wage Range',
			value: '$12.00-13.00/hour',
		})
	})

	test('a posting not on the board is a 404', async () => {
		expect((await get('/edu.stolaf/student-work/postings/9999')).status).toBe(404)
		expect((await get('/edu.stolaf/student-work/postings/abc')).status).toBe(404)
	})
})

describe('GET /edu.stolaf/student-work/units', () => {
	test('answers as the Node route does for the same postings', async () => {
		let response = await get('/edu.stolaf/student-work/units')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
		expect(await response.json()).toEqual(
			groupUnits({2841: '11725', 2799: '11727', 2903: null, 2770: '15141'}, listedUnitsOf(AREAS)),
		)
	})

	test('leaves out a posting whose detail could not be read', async () => {
		respond = (url) =>
			url.search.includes('2799') && url.href.startsWith(DETAIL)
				? new Response('', {status: 500})
				: undefined
		let body = await (await get('/edu.stolaf/student-work/units')).json<Record<string, string>>()
		expect(Object.keys(body).sort()).toEqual(['2770', '2841', '2903'])

		let listedOnly = (await list()).postings.find((posting) => posting.id === '2799')
		expect(listedOnly).toMatchObject({areas: [], unit: null, detailUpdatedAt: null, wage: null})
	})
})

describe('refreshing', () => {
	test('the next refresh is four hours out, give or take the jitter', async () => {
		await list()
		let at = await alarmAt()
		expect(at).toBeGreaterThanOrEqual(now + REFRESH_EVERY)
		expect(at).toBeLessThanOrEqual(now + REFRESH_EVERY + JITTER)
	})

	test('adds new postings, drops ones no longer listed, and reads only the new details', async () => {
		await list()
		fetchSpy.mockClear()

		board = [...FULL_BOARD.filter((posting) => posting.Id !== '2770'), listed('3100', '2030-10-09')]
		now += REFRESH_EVERY
		expect(await runDurableObjectAlarm(stub())).toBe(true)

		expect(calls(BOARD)).toHaveLength(1)
		// the new posting, and the one whose unit is still unread as null
		expect(detailCalls().sort()).toEqual(['2903', '3100'])
		let body = await list()
		expect(ids(body)).toEqual(['3100', '2841', '2903', '2799'])
		expect(body.updatedAt).toBe(new Date(now).toISOString())
		// nor is a dropped posting found by a search
		expect(ids(await list('?title=residence'))).toEqual([])
	})

	test('a day on, every detail is read again', async () => {
		await list()
		fetchSpy.mockClear()
		now += DAY + MINUTE
		await runDurableObjectAlarm(stub())
		expect(detailCalls().sort()).toEqual(['2770', '2799', '2841', '2903'])
	})

	test('a stored board past its refresh is answered at once and refreshed behind', async () => {
		await list()
		await runInDurableObject(stub(), (_do, state) => state.storage.deleteAlarm())
		fetchSpy.mockClear()
		now += REFRESH_EVERY + HOUR

		let body = await list()
		expect(body.count).toBe(4)
		expect(calls(BOARD)).toHaveLength(0)
		expect(await alarmAt()).toBe(now)
	})

	test('a failed refresh keeps the stored postings and backs off', async () => {
		await list()
		respond = (url) => (url.href.startsWith(BOARD) ? new Response('', {status: 500}) : undefined)
		now += REFRESH_EVERY
		await runDurableObjectAlarm(stub())

		expect(await alarmAt()).toBe(now + 5 * MINUTE)
		let body = await list()
		expect(body.count).toBe(4)
		expect(body.updatedAt).toBe(new Date(now - REFRESH_EVERY).toISOString())
	})

	test('an empty board in place of a full one is not taken', async () => {
		await list()
		board = []
		now += REFRESH_EVERY
		await runDurableObjectAlarm(stub())
		expect((await list()).count).toBe(4)
	})

	test('Oracle refusing a detail stops the run and backs off', async () => {
		respond = (url) => (url.href.startsWith(DETAIL) ? new Response('', {status: 429}) : undefined)
		let body = await list()
		expect(body.count).toBe(4)
		// four readers each stop after the refusal they meet
		expect(detailCalls().length).toBeLessThanOrEqual(4)
		expect(await alarmAt()).toBe(now + 5 * MINUTE)
	})

	test('a board bigger than one run reads the rest of its details soon after', async () => {
		board = Array.from({length: DETAILS_PER_RUN + 5}, (_, i) =>
			listed(String(5000 + i), '2030-10-01'),
		)
		await list()
		expect(detailCalls()).toHaveLength(DETAILS_PER_RUN)
		expect(await alarmAt()).toBe(now + 2 * MINUTE)

		fetchSpy.mockClear()
		now += 2 * MINUTE
		await runDurableObjectAlarm(stub())
		// only the five left over: the ones just read are not due again yet
		expect(detailCalls()).toHaveLength(5)
		expect(await alarmAt()).toBeGreaterThanOrEqual(now + REFRESH_EVERY)
	})
})
