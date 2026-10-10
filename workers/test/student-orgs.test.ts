import {env, exports} from 'cloudflare:workers'
import {runDurableObjectAlarm, runInDurableObject} from 'cloudflare:test'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {unavailableOrgs} from '../../source/ccci-carleton-college/v1/deprecated.ts'
import {convertJobPost, type JobPost} from '../../source/ccci-carleton-college/v1/jobs-shape.ts'
import {orgsFromHtml} from '../../source/ccci-carleton-college/v1/orgs-shape.ts'
import {portalFields} from '../../source/student-orgs/portal.ts'
import {
	orgDetail,
	presenceCategories,
	presenceOrgs,
	withoutDemoCategory,
	withoutDemoOrgs,
} from '../../source/student-orgs/presence-shape.ts'
import {deprecatedJobs, RETIRED_JOBS_TEXT} from '../../source/student-work/retired-jobs.ts'
import {clock} from '../src/clock.ts'
import {DETAIL_TTL} from '../src/student-orgs-do.ts'
import {spyOnFetch} from './spy.ts'
import carletonOrgsPage from './fixtures/carleton-orgs.html?raw'
import jobsFixture from './fixtures/carleton-student-jobs.json?raw'
import categoriesFixture from './fixtures/presence-categories.json?raw'
import orgsFixture from './fixtures/presence-orgs.json?raw'
import portalFixture from './fixtures/presence-portal.json?raw'

const PRESENCE = 'https://api.presence.io/stolaf/v1'
const LIST = `${PRESENCE}/organizations`
const CATEGORIES = `${PRESENCE}/organizations/categories`
const CAMPUS = `${PRESENCE}/app/campus`
const PORTAL = `${PRESENCE}/grid/portal-view/Organization/`
const CARLETON_ORGS = 'https://apps.carleton.edu/student/orgs/'
const CARLETON_JOBS = 'https://www.carleton.edu/student-employment/post-jobs/wp-json/wp/v2/posts'

type RawOrg = {uri: string; name: string; categories: string[]}

const ORGS = JSON.parse(orgsFixture) as RawOrg[]
const CAMPUS_BODY = {apiId: 'campus-id', cdn: 'https://cdn.example.net'}
const MEMBERSHIPS = JSON.parse(categoriesFixture) as unknown[]
const PORTAL_BODY = JSON.parse(portalFixture) as unknown
const JOB_POSTS = JSON.parse(jobsFixture) as JobPost[]
const CHALLENGE = '<!doctype html><title>Checking your browser - reCAPTCHA</title>'

const HOUR = 60 * 60 * 1000

let now = 0
let list: RawOrg[] = ORGS
let carletonPage = carletonOrgsPage
let respond: (url: URL) => Response | undefined = () => undefined
let fetchSpy: MockInstance<typeof fetch>
let warnSpy: {mockRestore: () => void}

const get = (path: string, headers?: HeadersInit) =>
	exports.default.fetch(new Request(`https://worker.test${path}`, {headers}))
const stolaf = () => env.STUDENT_ORGS.getByName('stolaf')
const carleton = () => env.STUDENT_ORGS.getByName('carleton')
const calls = (prefix: string) =>
	fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url.startsWith(prefix))
const callsTo = (address: string) =>
	fetchSpy.mock.calls.map(([input]) => String(input)).filter((url) => url === address)

/// What the Node server's routes answer for the fixtures.
const nodeOrgs = () => withoutDemoOrgs(presenceOrgs(list, CAMPUS_BODY))
const nodeCategories = () => withoutDemoCategory(presenceCategories(MEMBERSHIPS))

beforeEach(async () => {
	now = Date.parse('2030-10-10T12:00:00Z')
	clock.now = () => now
	list = ORGS
	carletonPage = carletonOrgsPage
	respond = () => undefined
	await stolaf().purge()
	await carleton().purge()
	await env.STUDENT_WORK.getByName('carleton').purge()

	fetchSpy = spyOnFetch()
	fetchSpy.mockImplementation((input) => {
		let url = new URL(String(input))
		let override = respond(url)
		if (override) return Promise.resolve(override)
		if (url.href === LIST) return Promise.resolve(Response.json(list))
		if (url.href === CAMPUS) return Promise.resolve(Response.json(CAMPUS_BODY))
		if (url.href === CATEGORIES) return Promise.resolve(Response.json(MEMBERSHIPS))
		if (url.href.startsWith(PORTAL)) return Promise.resolve(Response.json(PORTAL_BODY))
		if (url.href === CARLETON_ORGS) {
			return Promise.resolve(new Response(carletonPage, {headers: {'Content-Type': 'text/html'}}))
		}
		if (url.href.startsWith(CARLETON_JOBS)) {
			return Promise.resolve(Response.json(JOB_POSTS, {headers: {'x-wp-totalpages': '1'}}))
		}
		return Promise.resolve(new Response('not found', {status: 404}))
	})
	warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
	fetchSpy.mockRestore()
	warnSpy.mockRestore()
})

describe('GET /edu.stolaf/orgs', () => {
	test('answers every org as the Node route does, without the Demo ones', async () => {
		let response = await get('/edu.stolaf/orgs')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(response.headers.get('etag')).toBeTruthy()
		let body = await response.json<{organizationUri: string; photoUrl: string}[]>()
		expect(body).toEqual(nodeOrgs())
		expect(body.map((org) => org.organizationUri)).toEqual([
			'chess-club',
			'presente-2',
			'ultimate-frisbee',
			'90-degrees-north',
		])
		expect(body[0]?.photoUrl).toBe(
			'https://cdn.example.net/organization-photos/campus-id/chess-club.png?v=0',
		)
	})

	test('a second request is answered from storage, not Presence', async () => {
		await get('/edu.stolaf/orgs')
		await get('/edu.stolaf/orgs/categories')
		await get('/edu.stolaf/orgs')
		expect(callsTo(LIST)).toHaveLength(1)
		expect(callsTo(CAMPUS)).toHaveLength(1)
		expect(callsTo(CATEGORIES)).toHaveLength(1)
	})

	test('reads Presence only at its own addresses, without following redirects', async () => {
		await get('/edu.stolaf/orgs')
		for (let [input, init] of fetchSpy.mock.calls) {
			expect(new URL(String(input)).origin).toBe('https://api.presence.io')
			expect(init?.redirect).toBe('manual')
			expect(new Headers(init?.headers).get('User-Agent')).toBe('ccc-server/2.0')
		}
	})

	test.each([
		['?q=chess', ['chess-club']],
		['?q=CHE', ['chess-club']],
		['?q=cafe', ['90-degrees-north']],
		['?q=latinx music', ['presente-2']],
		['?q=nothing-like-this', []],
		['?category=Special%20Interest', ['chess-club', 'ultimate-frisbee']],
		['?category=Performance&category=Multicultural', ['presente-2', '90-degrees-north']],
		['?category=Special%20Interest&q=tournaments', ['ultimate-frisbee']],
		['?category=Demo', []],
		['?unknown=1', ['chess-club', 'presente-2', 'ultimate-frisbee', '90-degrees-north']],
	])('%s narrows the list', async (query, expected) => {
		let response = await get(`/edu.stolaf/orgs${query}`)
		expect(response.status).toBe(200)
		let body = await response.json<{organizationUri: string}[]>()
		expect(body.map((org) => org.organizationUri)).toEqual(expected)
	})

	test.each([['?q=a&q=b'], [`?q=${'x'.repeat(101)}`]])('%s is a 400', async (query) => {
		let response = await get(`/edu.stolaf/orgs${query}`)
		expect(response.status).toBe(400)
		expect(calls(PRESENCE)).toHaveLength(0)
	})

	test('with nothing stored and Presence down, a 502 kept briefly', async () => {
		respond = (url) => (url.href === LIST ? new Response('down', {status: 503}) : undefined)
		let response = await get('/edu.stolaf/orgs')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.json()).toEqual({
			message: 'Presence responded 503 for https://api.presence.io/stolaf/v1/organizations',
		})
	})

	test('a page in place of the list is a 502', async () => {
		respond = (url) =>
			url.href === LIST
				? new Response('<!doctype html><title>Sign in</title>', {
						headers: {'Content-Type': 'text/html'},
					})
				: undefined
		expect((await get('/edu.stolaf/orgs')).status).toBe(502)
	})

	test('a redirect is not followed', async () => {
		respond = (url) =>
			url.href === LIST
				? new Response(null, {status: 302, headers: {Location: 'https://elsewhere.example/'}})
				: undefined
		expect((await get('/edu.stolaf/orgs')).status).toBe(502)
		expect(calls('https://elsewhere.example')).toHaveLength(0)
	})

	test('an hour on, the list is read again: new orgs added, gone ones dropped', async () => {
		await get('/edu.stolaf/orgs')
		list = [
			...ORGS.filter((org) => org.uri !== 'presente-2'),
			{...ORGS[0]!, uri: 'go-club', name: 'Go Club'},
		]
		now += HOUR + 15 * 60 * 1000
		expect(await runDurableObjectAlarm(stolaf())).toBe(true)
		let body = await (await get('/edu.stolaf/orgs')).json<{organizationUri: string}[]>()
		expect(body).toEqual(nodeOrgs())
		expect(body.map((org) => org.organizationUri)).toContain('go-club')
		expect(body.map((org) => org.organizationUri)).not.toContain('presente-2')
		expect(callsTo(LIST)).toHaveLength(2)
	})

	test('the next refresh is an hour out, give or take ten minutes', async () => {
		await get('/edu.stolaf/orgs')
		let at = await runInDurableObject(stolaf(), (_do, state) => state.storage.getAlarm())
		expect(at).toBeGreaterThanOrEqual(now + HOUR)
		expect(at).toBeLessThanOrEqual(now + HOUR + 10 * 60 * 1000)
	})

	test('a failed refresh keeps the stored orgs', async () => {
		await get('/edu.stolaf/orgs')
		respond = (url) => (url.href === LIST ? new Response('down', {status: 500}) : undefined)
		now += 2 * HOUR
		await runDurableObjectAlarm(stolaf())
		let response = await get('/edu.stolaf/orgs')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(nodeOrgs())
	})

	test('an empty list in place of a full one is not taken', async () => {
		await get('/edu.stolaf/orgs')
		let full = nodeOrgs()
		list = []
		now += 2 * HOUR
		await runDurableObjectAlarm(stolaf())
		expect(await (await get('/edu.stolaf/orgs')).json()).toEqual(full)
	})

	test('a client holding the list is answered with a 304', async () => {
		let first = await get('/edu.stolaf/orgs')
		let etag = first.headers.get('etag')!
		let again = await get('/edu.stolaf/orgs', {'If-None-Match': etag})
		expect(again.status).toBe(304)
	})
})

describe('GET /edu.stolaf/orgs/categories', () => {
	test('answers each category with its orgs as the Node route does, without Demo', async () => {
		let response = await get('/edu.stolaf/orgs/categories')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body = await response.json()
		expect(body).toEqual(nodeCategories())
		expect(body).toEqual([
			{catIdh: 'CSpC', name: 'Club Sports - Competitive', organizationUris: ['ultimate-frisbee']},
			{catIdh: 'Mult', name: 'Multicultural', organizationUris: ['presente-2']},
			{catIdh: 'Perf', name: 'Performance', organizationUris: ['90-degrees-north']},
			{
				catIdh: 'SpIn',
				name: 'Special Interest',
				organizationUris: ['chess-club', 'ultimate-frisbee'],
			},
		])
	})
})

describe('GET /edu.stolaf/orgs/uri/:uri', () => {
	const chess = () => ORGS.find((org) => org.uri === 'chess-club')!

	test('answers one org with its details, as the Node route does', async () => {
		let response = await get('/edu.stolaf/orgs/uri/chess-club')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body = await response.json<Record<string, unknown>>()
		let listed = nodeOrgs().find((org) => org.organizationUri === chess().uri)!
		expect(body).toEqual(orgDetail(listed, portalFields(PORTAL_BODY)))
		expect(body).toMatchObject({
			description: 'We play **chess**.\n\nAll are welcome.',
			contacts: [
				{firstName: 'Ada', lastName: 'Example', title: 'Primary Contact', email: 'ada@example.edu'},
			],
			advisors: [{name: 'Grace Example', email: 'grace@example.edu'}],
			socialLinks: ['https://www.instagram.com/examplechess/'],
		})
		expect(calls(PORTAL)).toEqual([`${PORTAL}chess-club/`])
	})

	test('keeps only the fields it answers from an org’s form', async () => {
		await get('/edu.stolaf/orgs/uri/chess-club')
		let stored = await runInDurableObject(stolaf(), (_do, state) =>
			state.storage.sql.exec<{fields: string}>('SELECT fields FROM details').toArray(),
		)
		expect(stored).toHaveLength(1)
		expect(stored[0]?.fields).not.toContain('SECRET')
		expect(
			JSON.stringify(await (await get('/edu.stolaf/orgs/uri/chess-club')).json()),
		).not.toContain('SECRET')
	})

	test('a second request is answered from storage', async () => {
		await get('/edu.stolaf/orgs/uri/chess-club')
		await get('/edu.stolaf/orgs/uri/chess-club')
		expect(calls(PORTAL)).toHaveLength(1)
		expect(callsTo(LIST)).toHaveLength(1)
	})

	test('details past their hour are answered at once and read again behind', async () => {
		await get('/edu.stolaf/orgs/uri/chess-club')
		now += DETAIL_TTL + 1
		expect((await get('/edu.stolaf/orgs/uri/chess-club')).status).toBe(200)
		await vi.waitFor(() => {
			expect(calls(PORTAL)).toHaveLength(2)
		})
	})

	test.each([['not-an-org'], ['demo-org']])(
		'%s, not in the list, is a 404 without reading its form',
		async (uri) => {
			let response = await get(`/edu.stolaf/orgs/uri/${uri}`)
			expect(response.status).toBe(404)
			expect(calls(PORTAL)).toHaveLength(0)
		},
	)

	test.each([['Chess%20Club'], ['..'], ['chess_club'], [`a${'-b'.repeat(60)}`]])(
		'%s, not a Presence slug, is a 404 without reading anything',
		async (uri) => {
			let response = await get(`/edu.stolaf/orgs/uri/${uri}`)
			expect(response.status).toBe(404)
			expect(fetchSpy).not.toHaveBeenCalled()
		},
	)

	test('with the form unreadable and nothing stored, a 502 kept briefly', async () => {
		respond = (url) =>
			url.href.startsWith(PORTAL) ? new Response('down', {status: 500}) : undefined
		let response = await get('/edu.stolaf/orgs/uri/chess-club')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		// and it is not read again at once
		await get('/edu.stolaf/orgs/uri/chess-club')
		expect(calls(PORTAL)).toHaveLength(1)
	})

	test('an org dropped from the list loses its details', async () => {
		await get('/edu.stolaf/orgs/uri/chess-club')
		list = ORGS.filter((org) => org.uri !== 'chess-club')
		now += 2 * HOUR
		await runDurableObjectAlarm(stolaf())
		expect((await get('/edu.stolaf/orgs/uri/chess-club')).status).toBe(404)
		let stored = await runInDurableObject(stolaf(), (_do, state) =>
			state.storage.sql.exec('SELECT id FROM details').toArray(),
		)
		expect(stored).toEqual([])
	})
})

describe('GET /edu.carleton/orgs', () => {
	test('lists the orgs on Carleton’s page as the Node scraper reads them', async () => {
		let response = await get('/edu.carleton/orgs')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body = await response.json<{id: string; categories: string[]}[]>()
		expect(body).toEqual(orgsFromHtml(carletonOrgsPage))
		expect(body.map((org) => org.id)).toEqual(['chess', 'debate', 'ultimate'])
		expect(body[0]?.categories).toEqual(['Academic', 'Recreation'])
		expect(calls(CARLETON_ORGS)).toHaveLength(1)
	})

	test('?category= and ?q= narrow the list', async () => {
		let ids = async (query: string) =>
			(await (await get(`/edu.carleton/orgs${query}`)).json<{id: string}[]>()).map((org) => org.id)
		expect(await ids('?category=Recreation')).toEqual(['chess', 'ultimate'])
		expect(await ids('?q=disc')).toEqual(['ultimate'])
	})

	test('a bot check in place of the page answers the Node notice, kept briefly', async () => {
		carletonPage = CHALLENGE
		let response = await get('/edu.carleton/orgs')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.json()).toEqual(unavailableOrgs())
	})

	test('the notice gives way to the list once the page can be read', async () => {
		carletonPage = CHALLENGE
		await get('/edu.carleton/orgs')
		carletonPage = carletonOrgsPage
		now += 2 * HOUR
		await runDurableObjectAlarm(carleton())
		let body = await (await get('/edu.carleton/orgs')).json()
		expect(body).toEqual(orgsFromHtml(carletonOrgsPage))
	})

	test('a page that will not load is not read again while it backs off', async () => {
		carletonPage = CHALLENGE
		await get('/edu.carleton/orgs')
		await get('/edu.carleton/orgs')
		expect(calls(CARLETON_ORGS)).toHaveLength(1)
	})

	test('has no categories or org details', async () => {
		expect((await get('/edu.carleton/orgs/categories')).status).toBe(404)
		expect((await get('/edu.carleton/orgs/uri/chess')).status).toBe(404)
		expect(fetchSpy).not.toHaveBeenCalled()
	})
})

describe('GET /jobs', () => {
	test('St. Olaf’s answers the Node notice, the same at any time', async () => {
		let first = await get('/edu.stolaf/jobs')
		expect(first.status).toBe(200)
		expect(first.headers.get('cache-control')).toBe('public, max-age=600')
		let body = await first.json<{lastModified: string}[]>()
		expect(body).toEqual(deprecatedJobs(RETIRED_JOBS_TEXT, new Date('2026-10-10T12:00:00Z')))
		expect(body[0]?.lastModified).toBe('October 10, 2026')
		now += 30 * 24 * HOUR
		let later = await get('/edu.stolaf/jobs')
		expect(later.headers.get('etag')).toBe(first.headers.get('etag'))
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('Carleton’s lists the jobs as the Node route does, newest first', async () => {
		let response = await get('/edu.carleton/jobs')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let body = await response.json()
		expect(body).toEqual(JOB_POSTS.map(convertJobPost))
	})

	test('Carleton’s and the student work board share one read of the site', async () => {
		await get('/edu.carleton/jobs')
		await get('/edu.carleton/student-work/postings')
		await get('/edu.carleton/jobs')
		expect(calls(CARLETON_JOBS)).toHaveLength(1)
	})

	test('Carleton’s, with the site down and nothing stored, is a 502 kept briefly', async () => {
		respond = (url) =>
			url.href.startsWith(CARLETON_JOBS) ? new Response('down', {status: 500}) : undefined
		let response = await get('/edu.carleton/jobs')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})
})
