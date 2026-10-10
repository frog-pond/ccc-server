import {env, exports} from 'cloudflare:workers'
import {runInDurableObject} from 'cloudflare:test'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {streamsFrom} from '../../source/ccci-stolaf-college/v1/streams-shape.ts'
import type {EventType} from '../../source/calendar/types.ts'
import {itemsBefore, recordItems} from '../src/archive.ts'
import {calendarArchive} from '../src/archives/calendars.ts'
import {convosArchive, type Convo} from '../src/archives/convos.ts'
import {postsEndpoint} from '../src/archives/news.ts'
import {streamsArchive, type Stream} from '../src/archives/streams.ts'
import {clock} from '../src/clock.ts'
import {STOLAF_NEWS_URL, wpNews} from '../src/sources/wp-news.ts'
import {spyOnFetch} from './spy.ts'
import posts from './fixtures/stolaf-posts.json?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(typeof body === 'string' ? body : JSON.stringify(body), {
		status,
		headers: {'content-type': 'application/json', ...headers},
	})

const NOW = Date.parse('2030-01-15T18:00:00Z')
const DAY = 24 * 60 * 60 * 1000

const NORTHFIELD =
	'https://www.northfieldmn.gov/common/modules/iCalendar/iCalendar.aspx?catID=41&feed=calendar'

const streamsStub = () => env.ARCHIVE.getByName('streams:stolaf')
const newsStub = () => env.ARCHIVE.getByName(`news:${postsEndpoint(STOLAF_NEWS_URL)}`)
const calendarStub = () => env.ARCHIVE.getByName(`calendar:ical ${NORTHFIELD}`)
const convosStub = () => env.ARCHIVE.getByName('convos:carleton')

/// A stream starting `days` from now, with its own id.
const stream = (eid: number, days: number): Stream => {
	let start = new Date(NOW + days * DAY)
	let starttime = start.toISOString().slice(0, 16).replace('T', ' ')
	let [shaped] = streamsFrom({
		results: [
			{
				starttime,
				location: 'Boe Chapel',
				eid,
				performer: 'The Choir',
				subtitle: '',
				poster: 'https://www.stolaf.edu/poster.jpg',
				player: 'https://www.stolaf.edu/player',
				status: 'live',
				category: 'music',
				hptitle: `Stream ${String(eid)}`,
				category_textcolor: '#fff',
				category_color: '#000',
				thumb: 'https://www.stolaf.edu/thumb.jpg',
				title: `Stream ${String(eid)}`,
				iframesrc: 'https://www.stolaf.edu/iframe',
			},
		],
	}).streams
	if (!shaped) throw new Error('the stream did not shape')
	return shaped
}

const ids = (items: unknown[]) => (items as Stream[]).map((s) => s.eid)

const before = async (at: number, limit = 100) =>
	ids(await itemsBefore(env, streamsArchive, {}, at, limit))

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

beforeEach(async () => {
	clock.now = () => NOW
	for (let stub of [streamsStub(), newsStub(), calendarStub(), convosStub()]) await stub.purge()
	await env.SOURCE.getByName(`${wpNews.name}:${STOLAF_NEWS_URL}`).purge()
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

describe('an archive', () => {
	test('keeps what is recorded, latest first before a time', async () => {
		await recordItems(env, streamsArchive, {}, [stream(1, -3), stream(2, -1), stream(3, 2)])
		expect(await before(NOW)).toEqual([2, 1])
		expect(await before(NOW + 10 * DAY)).toEqual([3, 2, 1])
		expect(await before(NOW + 10 * DAY, 2)).toEqual([3, 2])
	})

	test('a live read drops only the future items in its span it no longer lists', async () => {
		await recordItems(env, streamsArchive, {}, [
			stream(1, -2),
			stream(2, 1),
			stream(3, 3),
			stream(4, 20),
		])
		await recordItems(env, streamsArchive, {}, [stream(3, 3)], {
			from: NOW - 5 * DAY,
			to: NOW + 10 * DAY,
		})
		// the past one stays, and so does the one past the span
		expect(await before(NOW + 30 * DAY)).toEqual([4, 3, 1])
	})

	test('a live copy replaces the stored one', async () => {
		await recordItems(env, streamsArchive, {}, [stream(1, -2)])
		let moved = {...stream(1, -1), title: 'Moved'}
		await recordItems(env, streamsArchive, {}, [moved])
		expect(await itemsBefore(env, streamsArchive, {}, NOW, 10)).toEqual([moved])
	})

	test('walks back through the history a few steps a run, keeping live copies', async () => {
		await recordItems(env, streamsArchive, {}, [{...stream(1, -1), title: 'Live'}])
		fetchSpy.mockImplementation((input) => {
			let offset = new URL(String(input)).searchParams.get('offset')
			let page =
				offset === '0' ? [stream(1, -1), stream(2, -5)].map(rawOf) : [stream(3, -9)].map(rawOf)
			return Promise.resolve(json({results: page, meta: {available: 3}}))
		})
		await runInDurableObject(streamsStub(), (instance) => instance.alarm())
		expect(fetchSpy).toHaveBeenCalledTimes(2)
		expect(await streamsStub().status()).toMatchObject({items: 3, done: true, failures: 0})
		let [latest] = await itemsBefore(env, streamsArchive, {}, NOW, 1)
		expect(latest?.title).toBe('Live')
	})

	test('a failed step backs off and is reported', async () => {
		await recordItems(env, streamsArchive, {}, [])
		fetchSpy.mockImplementation(() => Promise.resolve(json('boom', 503)))
		await runInDurableObject(streamsStub(), (instance) => instance.alarm())
		expect(await streamsStub().status()).toMatchObject({
			done: false,
			failures: 1,
			lastError: 'The streams collection responded 503',
		})
	})
})

/// What upstream sends for a shaped stream.
const rawOf = (s: Stream) => ({...s, starttime: s.starttime.slice(0, 16).replace('T', ' ')})

describe('?before=', () => {
	test.each([
		'/edu.stolaf/news/stolaf',
		'/edu.stolaf/calendar/northfield',
		'/edu.stolaf/streams/archived',
		'/edu.carleton/convos/archived',
	])('that is not a time is a 400 on %s', async (path) => {
		let response = await get(`${path}?before=last-week`)
		expect(response.status).toBe(400)
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('pages back through the news a live read recorded', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(json(posts)))
		let live = (await (await get('/edu.stolaf/news/stolaf')).json()) as {link: string}[]
		await vi.waitFor(async () => expect((await newsStub().status()).items).toBe(live.length))

		let response = await get('/edu.stolaf/news/stolaf?before=2100-01-01')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		let page = (await response.json()) as {link: string}[]
		expect(page.map((item) => item.link)).toEqual(live.map((item) => item.link))
		// fewer than a page, so the last
		expect(response.headers.get('link')).toBeNull()
	})

	test('pages back through the archived streams, soonest first unless asked', async () => {
		let kept = Array.from({length: 60}, (_, i) => stream(i + 1, -(i + 1)))
		await recordItems(env, streamsArchive, {}, [...kept, stream(100, 2)])

		let response = await get('/edu.stolaf/streams/archived?before=2100-01-01')
		let page = (await response.json()) as Stream[]
		// never the future, and a full page of 50, soonest first
		expect(page).toHaveLength(50)
		expect(page[0]?.eid).toBe(50)
		expect(page.at(-1)?.eid).toBe(1)
		let next = /<([^>]+)>; rel="next"/u.exec(response.headers.get('link') ?? '')?.[1] ?? ''
		let rest = (await (await get(next)).json()) as Stream[]
		expect(rest.map((s) => s.eid)).toEqual([60, 59, 58, 57, 56, 55, 54, 53, 52, 51])

		let descending = (await (
			await get('/edu.stolaf/streams/archived?before=2100-01-01&sort=descending')
		).json()) as Stream[]
		expect(descending[0]?.eid).toBe(1)
	})

	test('pages back through a calendar, soonest first, as of now', async () => {
		let event = (title: string, days: number): EventType =>
			({
				title,
				startTime: new Date(NOW + days * DAY).toISOString(),
				endTime: new Date(NOW + days * DAY + 3600_000).toISOString(),
				isOngoing: false,
				location: '',
				description: '',
				links: [],
				metadata: {uid: title},
				config: {startTime: true, endTime: true, subtitle: 'location'},
			}) as unknown as EventType
		await recordItems(env, calendarArchive, {kind: 'ical', url: NORTHFIELD}, [
			event('Old', -40),
			event('Older', -80),
			event('Soon', 3),
		])
		let response = await get(
			`/edu.stolaf/calendar/northfield?before=${new Date(NOW).toISOString()}`,
		)
		expect(response.status).toBe(200)
		expect(response.headers.get('link')).toBeNull()
		let page = (await response.json()) as EventType[]
		expect(page.map((e) => [e.title, e.isOngoing])).toEqual([
			['Older', true],
			['Old', true],
		])
	})

	test('pages back through the convocations, newest first', async () => {
		let convo = (title: string, days: number): Convo => ({
			title,
			description: '',
			pubDate: new Date(NOW + days * DAY).toISOString(),
			enclosure: {type: 'audio/mpeg', url: `https://www.carleton.edu/${title}.mp3`, length: '1'},
		})
		await recordItems(env, convosArchive, {}, [convo('a', -1), convo('b', -9), convo('c', -4)])
		let response = await get('/edu.carleton/convos/archived?before=2030-01-14')
		let page = (await response.json()) as Convo[]
		expect(page.map((c) => c.title)).toEqual(['c', 'b'])
	})
})
