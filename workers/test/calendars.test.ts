import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {registry} from '../src/registry.ts'
import {carletonCalendar, googleCalendar, ical, weeklySchedule} from '../src/sources/calendars.ts'
import {spyOnFetch} from './spy.ts'
import sumoFeed from './fixtures/carleton-sumo.ics?raw'
import sumoPage from './fixtures/carleton-sumo-schedule.html?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const answer = (body: string, type: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': type}})

// a time far enough ahead that no refresh alarm set from it is due; the
// fixture's events are moved to its year
const NOW = Date.parse('2030-10-09T12:00:00Z')
const SUMO_ICS = sumoFeed.replaceAll('2026', '2030')

const SUMO_FEED =
	'https://www.carleton.edu/student/orgs/sumo/schedule/?loadFeed=calendar&stamp=1714840383'
const SUMO_PAGE = 'https://www.carleton.edu/student/orgs/sumo/schedule/'
const NORTHFIELD =
	'https://www.northfieldmn.gov/common/modules/iCalendar/iCalendar.aspx?catID=41&feed=calendar'
const KSTO_SCHEDULE = 'https://stolaf.dev/AAO-React-Native/ksto-schedule.json'
const GOOGLE = 'https://www.googleapis.com/calendar/v3/calendars/'

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

const SOURCES = [
	`${carletonCalendar.name}:${SUMO_FEED} ${SUMO_PAGE}`,
	`${ical.name}:${NORTHFIELD}`,
	`${weeklySchedule.name}:${KSTO_SCHEDULE}`,
	`${googleCalendar.name}:krlxradio88.1@gmail.com`,
	`${googleCalendar.name}:kstonarwhal@gmail.com`,
]

// storage is not reset between tests, so each starts by emptying the calendars
beforeEach(async () => {
	clock.now = () => NOW
	for (let name of SOURCES) await env.SOURCE.getByName(name).purge()
	fetchSpy = spyOnFetch()
	// the routes log the failures these tests make on purpose
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const callsTo = (prefix: string) =>
	fetchSpy.mock.calls.filter(([input]) => String(input).startsWith(prefix))

/// The upstream answers, by address.
function serve(answers: Record<string, () => Response>) {
	fetchSpy.mockImplementation((input) => {
		let url = String(input)
		let key = Object.keys(answers).find((prefix) => url.startsWith(prefix))
		return Promise.resolve(key ? answers[key]!() : answer('not found', 'text/plain', 404))
	})
}

const CARLETON_SUMO = {
	[SUMO_PAGE + '?loadFeed']: () => answer(SUMO_ICS, 'text/calendar'),
	[SUMO_PAGE + '?start_date']: () => answer(sumoPage, 'text/html'),
}

describe.each(['edu.stolaf', 'edu.carleton'])('%s calendars', (campus) => {
	test('a Carleton calendar is its events with the pictures its page shows', async () => {
		serve(CARLETON_SUMO)
		let response = await get(`/${campus}/calendar/sumo-schedule`)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		let events = (await response.json()) as {title: string; image?: string}[]
		expect(events.map((e) => [e.title, e.image])).toEqual([
			[
				'SUMO Movie: I Love Boosters',
				'https://cdn.carleton.edu/uploads/sites/414/2026/08/Boosters.jpg',
			],
			[
				'SUMO Movie: I Love Boosters',
				'https://cdn.carleton.edu/uploads/sites/414/2026/08/Boosters.jpg',
			],
			[
				'SUMO Movie: The Shining',
				'https://cdn.carleton.edu/uploads/sites/414/2026/08/Screenshot-2026-07-13-124649.png',
			],
		])
	})

	test('the page is asked for the next month in campus dates, and the feed is read once', async () => {
		serve(CARLETON_SUMO)
		await get(`/${campus}/calendar/sumo-schedule`)
		expect(callsTo(SUMO_PAGE + '?start_date').map(([i]) => String(i))).toEqual([
			`${SUMO_PAGE}?start_date=2030-10-09&end_date=2030-11-09`,
		])
		expect(callsTo(SUMO_PAGE + '?loadFeed')).toHaveLength(1)
	})

	test('a page that cannot be read leaves the events without pictures', async () => {
		serve({
			[SUMO_PAGE + '?loadFeed']: () => answer(SUMO_ICS, 'text/calendar'),
			[SUMO_PAGE + '?start_date']: () => answer('gone', 'text/plain', 404),
		})
		let events = (await (await get(`/${campus}/calendar/sumo-schedule`)).json()) as object[]
		expect(events).toHaveLength(3)
		expect(events.filter((e) => 'image' in e)).toEqual([])
	})

	test('a second request is served from the object, not the site', async () => {
		serve(CARLETON_SUMO)
		await get(`/${campus}/calendar/sumo-schedule`)
		expect((await get(`/${campus}/calendar/sumo-schedule`)).status).toBe(200)
		expect(callsTo(SUMO_PAGE + '?loadFeed')).toHaveLength(1)
	})

	test('the site down with nothing stored is a 502, briefly cacheable', async () => {
		serve({[SUMO_PAGE]: () => answer('boom', 'text/plain', 503)})
		let response = await get(`/${campus}/calendar/sumo-schedule`)
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.json()).toMatchObject({message: expect.stringContaining('503')})
	})

	test('a page that is not a calendar is a 502, not an empty calendar', async () => {
		serve({[SUMO_PAGE]: () => answer('<html>Moved</html>', 'text/html')})
		expect((await get(`/${campus}/calendar/sumo-schedule`)).status).toBe(502)
	})

	test('a redirect is an error, and is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 301, headers: {location: 'https://elsewhere.example/'}}),
			),
		)
		let response = await get(`/${campus}/calendar/northfield`)
		expect(response.status).toBe(502)
		expect(await response.json()).toMatchObject({message: expect.stringContaining('301')})
		expect(fetchSpy.mock.calls.map(([i]) => String(i))).not.toContain('https://elsewhere.example/')
		expect(callsTo(NORTHFIELD)[0]?.[1]).toMatchObject({redirect: 'manual'})
	})

	test('an iCal feed is read with its events soonest first', async () => {
		let ics = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'X-WR-TIMEZONE:America/Chicago',
			'BEGIN:VEVENT',
			'UID:late',
			'DTSTART:20301020T190000',
			'DTEND:20301020T200000',
			'SUMMARY:Later',
			'END:VEVENT',
			'BEGIN:VEVENT',
			'UID:early',
			'DTSTART:20301010T190000',
			'DTEND:20301010T200000',
			'SUMMARY:Sooner',
			'END:VEVENT',
			'BEGIN:VEVENT',
			'UID:over',
			'DTSTART:20300101T190000',
			'DTEND:20300101T200000',
			'SUMMARY:Over',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n')
		serve({[NORTHFIELD]: () => answer(ics, 'text/calendar')})
		let events = (await (await get(`/${campus}/calendar/northfield`)).json()) as {title: string}[]
		expect(events.map((e) => e.title)).toEqual(['Sooner', 'Later'])
	})

	test('a Google calendar is read with the worker key, which is not in the answer', async () => {
		serve({
			[GOOGLE]: () =>
				answer(
					JSON.stringify({
						items: [
							{
								summary: 'Show',
								start: {dateTime: '2030-10-10T19:00:00-05:00'},
								end: {dateTime: '2030-10-10T21:00:00-05:00'},
							},
						],
					}),
					'application/json',
				),
		})
		let response = await get(`/${campus}/calendar/krlx-schedule`)
		expect(response.status).toBe(200)
		expect(await response.text()).not.toContain('test-calendar-key')
		let [url] = callsTo(GOOGLE)[0] ?? []
		let asked = new URL(String(url))
		expect(asked.pathname).toBe('/calendar/v3/calendars/krlxradio88.1%40gmail.com/events')
		expect(asked.searchParams.get('key')).toBe('test-calendar-key')
		expect(asked.searchParams.get('timeMin')).toBe('2030-10-09T12:00:00.000Z')
	})

	test('a retired calendar is a notice, kept for a day', async () => {
		for (let name of ['the-cave', 'oleville']) {
			let response = await get(`/${campus}/calendar/${name}`)
			expect(response.status).toBe(200)
			expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
			expect(await response.json()).toMatchObject([
				{
					dataSource: 'deprecated',
					title: 'No longer updated',
					startTime: '2030-10-09T12:00:00.000Z',
				},
			])
		}
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	test('an unknown calendar is a 404', async () => {
		expect((await get(`/${campus}/calendar/nope`)).status).toBe(404)
		expect((await get(`/${campus}/calendar/constructor`)).status).toBe(404)
	})

	test('the arbitrary-address calendar routes are not served', async () => {
		expect((await get(`/${campus}/calendar/ics?url=https://example.com/a.ics`)).status).toBe(404)
		expect((await get(`/${campus}/calendar/google?id=a@b.c`)).status).toBe(404)
	})
})

describe('the calendars that differ by campus', () => {
	test("St. Olaf's own calendar is a notice kept a minute", async () => {
		let response = await get('/edu.stolaf/calendar/stolaf')
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
		expect(await response.json()).toMatchObject([{title: 'Temporarily unavailable'}])
	})

	test("Carleton's copy of it is retired, kept a day", async () => {
		let response = await get('/edu.carleton/calendar/stolaf')
		expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
		expect(await response.json()).toMatchObject([
			{title: 'No longer updated', description: expect.stringContaining('St. Olaf')},
		])
	})

	test('KSTO at St. Olaf is its weekly schedule', async () => {
		serve({
			[KSTO_SCHEDULE]: () =>
				answer(
					JSON.stringify({
						data: {
							updated: '2030-10-01T00:00:00Z',
							timezone: 'America/Chicago',
							shows: [{day: 'thursday', start: '14:00', end: '15:00', title: 'Golf Carts'}],
						},
					}),
					'application/json',
				),
		})
		let events = (await (await get('/edu.stolaf/calendar/ksto-schedule')).json()) as {
			title: string
			startTime: string
		}[]
		// Wednesday 9 October 2030, 12:00Z: the next Thursday show is the 10th at 14:00 Central
		expect(events[0]).toMatchObject({title: 'Golf Carts', startTime: '2030-10-10T19:00:00.000Z'})
		expect(callsTo(GOOGLE)).toHaveLength(0)
	})

	test('KSTO at Carleton is the Google calendar', async () => {
		serve({[GOOGLE]: () => answer(JSON.stringify({items: []}), 'application/json')})
		expect((await get('/edu.carleton/calendar/ksto-schedule')).status).toBe(200)
		expect(new URL(String(callsTo(GOOGLE)[0]?.[0])).pathname).toContain('kstonarwhal%40gmail.com')
		expect(callsTo(KSTO_SCHEDULE)).toHaveLength(0)
	})

	test('the convocations list is where Carleton serves it', async () => {
		let convos = 'https://www.carleton.edu/convocations/calendar/'
		serve({
			[convos]: () => answer(SUMO_ICS, 'text/calendar'),
		})
		expect((await get('/edu.carleton/convos/upcoming')).status).toBe(200)
		expect(callsTo(convos)).toHaveLength(2)
		expect((await get('/edu.stolaf/convos/upcoming')).status).toBe(404)
	})
})

describe('the calendar sources', () => {
	test('are registered by the worker entry point', async () => {
		await import('../src/worker.ts')
		for (let source of [ical, carletonCalendar, googleCalendar, weeklySchedule]) {
			expect(registry[source.name]).toBe(source)
		}
	})

	test('refuse an address that is not one they read, without fetching', async () => {
		fetchSpy.mockClear()
		await expect(fetchSource(env, ical, {url: 'https://example.com/a.ics'})).rejects.toThrow(
			/not a calendar this reads/,
		)
		await expect(
			fetchSource(env, weeklySchedule, {url: 'https://example.com/schedule.json'}),
		).rejects.toThrow(/not a calendar this reads/)
		expect(
			fetchSpy.mock.calls.filter(([i]) => new URL(String(i)).hostname === 'example.com'),
		).toEqual([])
	})
})
