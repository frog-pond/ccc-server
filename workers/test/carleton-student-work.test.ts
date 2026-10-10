import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {clock} from '../src/clock.ts'
import {carletonStudentWork} from '../src/sources/carleton-student-work.ts'
import {spyOnFetch} from './spy.ts'
import jobs from './fixtures/carleton-student-jobs.json?raw'

const API = 'https://www.carleton.edu/student-employment/post-jobs/wp-json/wp/v2/posts'

type Post = {id: number; _embedded: {'wp:term': {taxonomy: string; name: string}[][]}}

const POSTS = JSON.parse(jobs) as Post[]
/// The Cave's marketing job, filed as archived.
const ARCHIVED = {
	...POSTS[0]!,
	id: 9999,
	_embedded: {'wp:term': [[{taxonomy: 'category', name: 'Archived'}]]},
}

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))
const list = async (query = '') => {
	let response = await get(`/edu.carleton/student-work/postings${query}`)
	return {
		response,
		body: (await response.json()) as {
			count: number
			postings: {id: string; title: string; description?: unknown}[]
			message?: string
		},
	}
}
const ids = async (query: string) => (await list(query)).body.postings.map((posting) => posting.id)

let fetchSpy: MockInstance<typeof fetch>
let warnSpy: {mockRestore: () => void}
let upstream: () => Response

beforeEach(async () => {
	clock.now = () => Date.now()
	await env.SOURCE.getByName(`${carletonStudentWork.name}:carleton`).purge()
	upstream = () =>
		Response.json([...POSTS, ARCHIVED], {headers: {'x-wp-total': '5', 'x-wp-totalpages': '1'}})
	fetchSpy = spyOnFetch()
	fetchSpy.mockImplementation((input) =>
		Promise.resolve(String(input).startsWith(API) ? upstream() : new Response(null, {status: 404})),
	)
	warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
	fetchSpy.mockRestore()
	warnSpy.mockRestore()
	vi.restoreAllMocks()
})

describe('Carleton /student-work/postings', () => {
	test('lists the jobs newest first, without archived ones or descriptions', async () => {
		let {response, body} = await list()
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
		expect(body.postings.map((posting) => posting.id)).toEqual(['4069', '4063', '4060', '3732'])
		expect(body.count).toBe(4)
		expect(body.postings[0]).not.toHaveProperty('description')
		let [requested] = fetchSpy.mock.calls.map(([input]) => new URL(String(input)))
		expect(requested?.searchParams.get('per_page')).toBe('100')
		expect(requested?.searchParams.get('_embed')).toBe('wp:term')
	})

	test('reads the labelled lines and the categories', async () => {
		let {body} = await list()
		expect(body.postings[0]).toMatchObject({
			id: '4069',
			title: 'Marketing Assistant, The Cave',
			department: 'Student Activities',
			dateOpen: '10/22/2026',
			opensOn: '2026-10-22',
			postedAt: '2026-10-07T17:25:30.000Z',
			duringTerm: true,
			duringBreak: false,
			offCampus: false,
			links: [
				'https://carleton-wp-production.s3.amazonaws.com/uploads/sites/442/2026/10/Cave-Marketing-Position.pdf',
			],
		})
		expect(body.postings.find((posting) => posting.id === '3732')).toMatchObject({
			offCampus: true,
			department: 'Center for Community and Civic Engagement',
			employer: 'Carleton College, One North College St, Northfield, MN 55057',
			wage: '$13.50 per hour for 2026-2027 academic year',
			supervisor: 'Tessa Kiesow',
			opensOn: null,
		})
	})

	test.each([
		['?when=break', ['4063']],
		['?when=term,break', ['4069', '4063', '4060', '3732']],
		['?off_campus=true', ['3732']],
		['?off_campus=false&when=term', ['4069', '4063', '4060']],
		['?posted_since=2026-10-02', ['4069', '4063']],
		['?q=instagram', ['4069']],
		['?q=GROUNDS', ['4063']],
		['?q=libr', ['4060']],
		['?title=assist', ['4069', '3732']],
		['?title=instagram', []],
		['?q=nothing-like-this', []],
	])('%s narrows the list', async (query, expected) => {
		expect(await ids(query)).toEqual(expected)
	})

	test('sort=relevance puts a title match first', async () => {
		let newest = await ids('?q=research')
		let relevant = await ids('?q=research&sort=relevance')
		expect(new Set(relevant)).toEqual(new Set(newest))
		expect(relevant[0]).toBe('4060')
	})

	test.each([
		'?unit=12345',
		'?when=summer',
		'?off_campus=yes',
		'?posted_since=10/01/2026',
		'?sort=oldest',
		'?q=a&q=b',
		`?q=${'x'.repeat(101)}`,
	])('%s is a 400', async (query) => {
		let {response, body} = await list(query)
		expect(response.status).toBe(400)
		expect(body.message).toBeTypeOf('string')
	})

	test('is a 502 when the site has never been read', async () => {
		upstream = () => new Response('down', {status: 503})
		let {response, body} = await list()
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(body.message).not.toMatch(/\?/u)
	})

	test('reads every page of a long list', async () => {
		let many = Array.from({length: 100}, (_, i) => ({...POSTS[1]!, id: 5000 + i}))
		fetchSpy.mockImplementation((input) => {
			let page = new URL(String(input)).searchParams.get('page')
			let headers = {'x-wp-totalpages': '2'}
			return Promise.resolve(Response.json(page === '1' ? many : [POSTS[0]], {headers}))
		})
		let {body} = await list()
		expect(body.count).toBe(101)
		expect(fetchSpy).toHaveBeenCalledTimes(2)
	})

	test('does not follow a redirect', async () => {
		await list()
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})
})

describe('Carleton /student-work/postings/:id', () => {
	test('is one job, with its description', async () => {
		let response = await get('/edu.carleton/student-work/postings/4063')
		expect(response.status).toBe(200)
		let body = (await response.json()) as {
			title: string
			description: {markdown: string; fields: {label: string}[]; html: string}
		}
		expect(body.title).toBe('Grounds Student Employee')
		expect(body.description.fields.map((field) => field.label)).toContain('Department or Office')
		expect(body.description.markdown).not.toMatch(/Department or Office/u)
		expect(body.description.markdown).toMatch(/Grounds Department manages/u)
		expect(body.description.html).toMatch(/^<p>/u)
	})

	test('is a 404 for a job not on the board, or archived', async () => {
		expect((await get('/edu.carleton/student-work/postings/1')).status).toBe(404)
		expect((await get('/edu.carleton/student-work/postings/9999')).status).toBe(404)
	})

	test('Carleton has no units route', async () => {
		expect((await get('/edu.carleton/student-work/units')).status).toBe(404)
	})
})
