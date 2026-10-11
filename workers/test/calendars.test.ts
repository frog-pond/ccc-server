import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {fetchSource} from '../src/client.ts'
import {clock} from '../src/clock.ts'
import {registry} from '../src/registry.ts'
import {
	carletonCalendar,
	googleCalendar,
	ical,
	presence,
	tec,
	weeklySchedule,
} from '../src/sources/calendars.ts'
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
const CONVOS_PAGE = 'https://www.carleton.edu/convocations/calendar/'
const CONVOS_FEED = `${CONVOS_PAGE}?loadFeed=calendar&stamp=1714843936`
const PRESENCE = 'https://api.presence.io/stolaf/v1/events'
const TEC = 'https://wp.stolaf.edu/calendar/wp-json/tribe/events/v1/events'
const NORTHFIELD =
	'https://www.northfieldmn.gov/common/modules/iCalendar/iCalendar.aspx?catID=41&feed=calendar'
const KSTO_SCHEDULE = 'https://stolaf.dev/AAO-React-Native/ksto-schedule.json'
const GOOGLE = 'https://www.googleapis.com/calendar/v3/calendars/'

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: MockInstance<typeof console.error>

const SOURCES = [
	`${carletonCalendar.name}:${SUMO_FEED} ${SUMO_PAGE}`,
	`${carletonCalendar.name}:${CONVOS_FEED} ${CONVOS_PAGE}`,
	`${ical.name}:${NORTHFIELD}`,
	`${presence.name}:${PRESENCE}`,
	`${tec.name}:${TEC}`,
	`${weeklySchedule.name}:${KSTO_SCHEDULE}`,
	`${googleCalendar.name}:krlxradio88.1@gmail.com`,
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
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
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
		let [url, init] = callsTo(GOOGLE)[0] ?? []
		let asked = new URL(String(url))
		expect(asked.pathname).toBe('/calendar/v3/calendars/krlxradio88.1%40gmail.com/events')
		// the key is a header, so the address a trace records does not carry it
		expect(asked.searchParams.has('key')).toBe(false)
		expect(new Headers(init?.headers).get('X-Goog-Api-Key')).toBe('test-calendar-key')
		expect(asked.searchParams.get('timeMin')).toBe('2030-10-09T12:00:00.000Z')
	})

	test('KSTO is the weekly schedule', async () => {
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
		let events = (await (await get(`/${campus}/calendar/ksto-schedule`)).json()) as {
			title: string
			startTime: string
		}[]
		// Wednesday 9 October 2030, 12:00Z: the next Thursday show is the 10th at 14:00 Central
		expect(events[0]).toMatchObject({title: 'Golf Carts', startTime: '2030-10-10T19:00:00.000Z'})
		expect(callsTo(GOOGLE)).toHaveLength(0)
	})

	test('a Google calendar that fails does not give the key away', async () => {
		serve({[GOOGLE]: () => answer('forbidden', 'text/plain', 403)})
		let response = await get(`/${campus}/calendar/krlx-schedule`)
		expect(response.status).toBe(502)
		let body = await response.text()
		expect(body).toContain('403')
		expect(body).not.toContain('test-calendar-key')
		expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('test-calendar-key')
	})

	test('a retired calendar is a notice', async () => {
		for (let name of ['the-cave', 'oleville']) {
			let response = await get(`/${campus}/calendar/${name}`)
			expect(response.status).toBe(200)
			expect(response.headers.get('cache-control')).toBe('public, max-age=600')
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
	test('the convocations list is where Carleton serves it', async () => {
		let convos = CONVOS_PAGE
		serve({
			[convos]: () => answer(SUMO_ICS, 'text/calendar'),
		})
		expect((await get('/edu.carleton/convos/upcoming')).status).toBe(200)
		expect(callsTo(convos)).toHaveLength(2)
		expect((await get('/edu.stolaf/convos/upcoming')).status).toBe(404)
	})
})

describe("St. Olaf's own calendars", () => {
	const presenceEvent = (over: object = {}) => ({
		eventNoSqlId: 'abc',
		uri: 'outs-fall-camping-trip',
		eventName: 'OUTS Fall Camping Trip',
		organizationName: 'Oles Under the Sun (OUTS)',
		description:
			'<p>Two nights at White Water&nbsp;State Park. See https://outs.stolaf.edu/trip</p>',
		location: 'White Water State Park',
		hasCoverImage: true,
		photoUriWithVersion: 'photo.jpeg?v=0',
		startDateTimeUtc: '2030-10-12T15:30:00Z',
		endDateTimeUtc: '2030-10-14T21:00:00Z',
		// fields Presence sends that are not read
		contactName: 'Grace Sundell',
		contactEmail: 'someone@stolaf.edu',
		rsvpAnswer: -1,
		...over,
	})

	describe('student-orgs', () => {
		test('is the events Presence lists that are on or still to come, soonest first', async () => {
			serve({
				[PRESENCE]: () =>
					answer(
						JSON.stringify([
							presenceEvent(),
							presenceEvent({
								eventName: 'Over',
								startDateTimeUtc: '2030-10-01T15:00:00Z',
								endDateTimeUtc: '2030-10-01T16:00:00Z',
							}),
							presenceEvent({
								uri: 'bare',
								eventName: 'Bare',
								description: undefined,
								location: undefined,
								hasCoverImage: false,
								photoUriWithVersion: undefined,
								startDateTimeUtc: '2030-10-10T15:00:00Z',
								endDateTimeUtc: '2030-10-10T16:00:00Z',
							}),
							presenceEvent({eventName: 'Not an event', startDateTimeUtc: undefined}),
						]),
						'application/json',
					),
			})
			let response = await get('/edu.stolaf/calendar/student-orgs')
			expect(response.status).toBe(200)
			expect(response.headers.get('cache-control')).toBe('public, max-age=600')
			let events = (await response.json()) as Record<string, unknown>[]
			expect(events.map((e) => e['title'])).toEqual(['Bare', 'OUTS Fall Camping Trip'])
			expect(events[0]).toEqual({
				dataSource: 'presence',
				startTime: '2030-10-10T15:00:00.000Z',
				endTime: '2030-10-10T16:00:00.000Z',
				title: 'Bare',
				description: '',
				location: '',
				isOngoing: false,
				links: ['https://stolaf.presence.io/event/bare'],
				metadata: expect.objectContaining({
					uid: 'abc',
					organization: 'Oles Under the Sun (OUTS)',
				}),
				config: {startTime: true, endTime: true, subtitle: 'location'},
			})
			expect(events[1]).toMatchObject({
				description: 'Two nights at White Water State Park. See https://outs.stolaf.edu/trip',
				location: 'White Water State Park',
				links: [
					'https://outs.stolaf.edu/trip',
					'https://stolaf.presence.io/event/outs-fall-camping-trip',
				],
				image:
					'https://stolaf-cdn.presence.io/event-photos/09ddef77-5009-4348-8540-c9bfc6ade6bc/photo.jpeg?v=0',
			})
		})

		test('events that cannot be read are errors only when none can', async () => {
			serve({[PRESENCE]: () => answer(JSON.stringify([{nope: 1}]), 'application/json')})
			expect((await get('/edu.stolaf/calendar/student-orgs')).status).toBe(502)
		})

		test('a response that is not a list is a 502', async () => {
			serve({[PRESENCE]: () => answer(JSON.stringify({error: 'down'}), 'application/json')})
			expect((await get('/edu.stolaf/calendar/student-orgs')).status).toBe(502)
		})

		test('no events is an empty calendar', async () => {
			serve({[PRESENCE]: () => answer('[]', 'application/json')})
			expect(await (await get('/edu.stolaf/calendar/student-orgs')).json()).toEqual([])
		})
	})

	describe.each(['edu.stolaf', 'edu.carleton'])('stolaf on %s', (campus) => {
		const tecEvent = (over: object = {}) => ({
			id: 1,
			title: 'Lion&#8217;s Pause &#038; Friends',
			description: '<p>Come by. More at https://www.stolaf.edu/pause</p>',
			url: 'https://wp.stolaf.edu/calendar/event/pause/',
			all_day: false,
			utc_start_date: '2030-10-11 17:00:00',
			utc_end_date: '2030-10-11 18:00:00',
			venue: {venue: 'Buntrock Commons Lion&#8217;s Pause', address: 'ignored'},
			organizer: [{organizer: 'Student Activities &#038; Programs'}],
			categories: [{name: 'Music &#038; Arts'}],
			...over,
		})
		const NEXT = `${TEC}/?per_page=50&page=2`

		/// Two pages, as TEC lays them out: the first names the second.
		function servePages(second: () => Response = () => pageTwo()) {
			fetchSpy.mockImplementation((input) => {
				let url = new URL(String(input))
				if (url.hostname !== 'wp.stolaf.edu')
					return Promise.resolve(answer('no', 'text/plain', 404))
				return Promise.resolve(url.searchParams.get('page') === '2' ? second() : pageOne())
			})
		}
		const pageOne = () =>
			answer(
				JSON.stringify({
					events: [
						tecEvent({
							id: 2,
							title: 'Exhibition',
							all_day: true,
							utc_start_date: '2030-09-11 05:00:00',
							utc_end_date: '2030-12-07 05:59:59',
							venue: [],
							organizer: [],
							categories: [],
						}),
					],
					next_rest_url: NEXT,
				}),
				'application/json',
			)
		const pageTwo = () => answer(JSON.stringify({events: [tecEvent()]}), 'application/json')

		test('is the college calendar, read across its pages and shaped', async () => {
			servePages()
			let response = await get(`/${campus}/calendar/stolaf`)
			expect(response.status).toBe(200)
			expect(response.headers.get('cache-control')).toBe('public, max-age=600')
			let events = (await response.json()) as Record<string, unknown>[]
			expect(events.map((e) => e['title'])).toEqual(['Exhibition', 'Lion’s Pause & Friends'])
			expect(events[0]).toEqual({
				dataSource: 'tribe',
				startTime: '2030-09-11T05:00:00.000Z',
				endTime: '2030-12-07T05:59:59.000Z',
				title: 'Exhibition',
				description: 'Come by. More at https://www.stolaf.edu/pause',
				location: '',
				isOngoing: true,
				links: ['https://stolaf.edu/pause', 'https://wp.stolaf.edu/calendar/event/pause/'],
				metadata: {uid: '2', categories: []},
				// an all-day event shows no times
				config: {startTime: false, endTime: false, subtitle: 'location'},
			})
			expect(events[1]).toMatchObject({
				location: 'Buntrock Commons Lion’s Pause',
				isOngoing: false,
				metadata: {
					uid: '1',
					categories: ['Music & Arts'],
					organization: ['Student Activities & Programs'],
				},
				config: {startTime: true, endTime: true, subtitle: 'location'},
			})
		})

		test('asks for the next month in campus dates, fifty at a time, and follows the next page', async () => {
			servePages()
			await get(`/${campus}/calendar/stolaf`)
			let asked = fetchSpy.mock.calls.map(([i]) => String(i))
			expect(asked).toHaveLength(2)
			let first = new URL(asked[0] ?? '')
			expect(first.origin + first.pathname).toBe(TEC)
			// 07:00 on 9 October on campus: the day before reaches an event ending early today
			expect(Object.fromEntries(first.searchParams)).toEqual({
				per_page: '50',
				ends_after: '2030-10-08',
				starts_before: '2030-11-09',
			})
			expect(asked[1]).toBe(NEXT)
			expect(fetchSpy.mock.calls.every(([, init]) => init?.redirect === 'manual')).toBe(true)
		})

		test('a next page on another host is refused, not fetched', async () => {
			fetchSpy.mockImplementation(() =>
				Promise.resolve(
					answer(
						JSON.stringify({
							events: [tecEvent()],
							next_rest_url: 'https://elsewhere.example/page2',
						}),
						'application/json',
					),
				),
			)
			let response = await get(`/${campus}/calendar/stolaf`)
			expect(response.status).toBe(502)
			expect(fetchSpy.mock.calls.map(([i]) => new URL(String(i)).hostname)).not.toContain(
				'elsewhere.example',
			)
		})

		test('a feed that never ends is a 502, not a short calendar', async () => {
			fetchSpy.mockImplementation(() =>
				Promise.resolve(
					answer(JSON.stringify({events: [tecEvent()], next_rest_url: NEXT}), 'application/json'),
				),
			)
			expect((await get(`/${campus}/calendar/stolaf`)).status).toBe(502)
			expect(fetchSpy).toHaveBeenCalledTimes(10)
		})

		test('a page that fails with nothing stored is a 502', async () => {
			servePages(() => answer('boom', 'text/plain', 503))
			let response = await get(`/${campus}/calendar/stolaf`)
			expect(response.status).toBe(502)
			expect(await response.json()).toMatchObject({message: expect.stringContaining('503')})
		})

		test('events that cannot be read are errors only when none can', async () => {
			fetchSpy.mockImplementation(() =>
				Promise.resolve(
					answer(JSON.stringify({events: [{title: 'No dates'}]}), 'application/json'),
				),
			)
			expect((await get(`/${campus}/calendar/stolaf`)).status).toBe(502)
		})
	})

	test('Carleton does not serve them', async () => {
		expect((await get('/edu.carleton/calendar/student-orgs')).status).toBe(404)
	})
})

describe('the calendar sources', () => {
	test('are registered by the worker entry point', async () => {
		await import('../src/worker.ts')
		for (let source of [ical, carletonCalendar, googleCalendar, weeklySchedule, presence, tec]) {
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
