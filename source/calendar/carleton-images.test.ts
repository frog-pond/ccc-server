import {readFileSync} from 'node:fs'
import {test, type TestContext} from 'node:test'
import moment from 'moment-timezone'
import {carletonCalendar, eventCode, eventImages, withEventImages} from './carleton-images.ts'
import {EventSchema} from './types.ts'

/// A Carleton calendar list page as its WordPress theme renders it: each event
/// an `event_list--item`, its picture (when it has one) first, then the title
/// linking to `?eId=<code>`.
const LIST_PAGE = `<!doctype html>
<html><body><ul class="event_list">
<li class="event_list--item timed_event">
	<picture class="image--round"><a href="?eId=ut5L"><img src="https://cdn.carleton.edu/uploads/sites/414/2026/08/Boosters.jpg?resize=100,100&amp;crop=28,0,43,100" alt="SUMO Movie: I Love Boosters" class="image--round" loading="lazy"></a></picture>
	<h3><a href="?eId=ut5L">SUMO Movie: I Love Boosters</a></h3>
</li>
<li class="event_list--item timed_event">
	<h3><a href="?eId=uumg">Shy Forms</a></h3>
</li>
<li class="event_list--item all_day_event">
	<picture class="image--round"><a href="https://www.carleton.edu/calendar/?eId=ut6b&amp;foo=1"><img src="https://cdn.carleton.edu/uploads/sites/414/2026/08/Totoro.png?resize=100,100" alt="Totoro"></a></picture>
	<h3><a href="https://www.carleton.edu/calendar/?eId=ut6b&amp;foo=1">Totoro</a></h3>
</li>
</ul></body></html>`

void test('eventImages maps each pictured event to its full-size image', (t) => {
	let images = eventImages(LIST_PAGE, 'https://www.carleton.edu/student/orgs/sumo/schedule/')

	t.assert.deepEqual(
		[...images],
		[
			['ut5L', 'https://cdn.carleton.edu/uploads/sites/414/2026/08/Boosters.jpg'],
			['ut6b', 'https://cdn.carleton.edu/uploads/sites/414/2026/08/Totoro.png'],
		],
	)
})

void test('eventImages finds nothing in a page with no event list', (t) => {
	t.assert.equal(eventImages('<!doctype html><p>Moved</p>', 'https://www.carleton.edu/').size, 0)
})

void test('eventCode reads the short code from the end of the description', (t) => {
	let description =
		'Event Details:\nhttps://www.carleton.edu/student/orgs/sumo/\n\nView this event on the Carleton College website:\nhttps://www.carleton.edu/_c/ut5L'

	t.assert.equal(eventCode(description), 'ut5L')
})

void test('eventCode ignores the athletics placeholder', (t) => {
	t.assert.equal(
		eventCode(
			'View this event on the Carleton College website:\nhttps://www.carleton.edu/_c/undefined',
		),
		undefined,
	)
	t.assert.equal(eventCode('No link here'), undefined)
})

function event(title: string, description: string) {
	return EventSchema.parse({
		dataSource: 'ical',
		startTime: '2026-10-10T00:00:00.000Z',
		endTime: '2026-10-10T02:00:00.000Z',
		title,
		description,
		isOngoing: false,
		links: [],
		config: {startTime: true, endTime: true, subtitle: 'location'},
	})
}

void test('withEventImages adds an image only to events the page pictures', (t) => {
	let images = new Map([['ut5L', 'https://cdn.carleton.edu/Boosters.jpg']])
	let [boosters, shyForms] = withEventImages(
		[
			event('SUMO Movie: I Love Boosters', 'https://www.carleton.edu/_c/ut5L'),
			event('Shy Forms', 'https://www.carleton.edu/_c/uumg'),
		],
		images,
	)

	t.assert.equal(boosters?.image, 'https://cdn.carleton.edu/Boosters.jpg')
	t.assert.equal(shyForms && 'image' in shyForms, false)
})

const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

function serveSumo(
	t: TestContext,
	page = () => new Response(fixture('carleton-sumo-schedule.html')),
) {
	let requested: string[] = []
	t.mock.method(globalThis, 'fetch', (request: Parameters<typeof fetch>[0]) => {
		let url = request instanceof Request ? request.url : String(request)
		requested.push(url)
		return Promise.resolve(
			url.includes('loadFeed=calendar') ? new Response(fixture('carleton-sumo.ics')) : page(),
		)
	})
	return requested
}

const SUMO_FEED = 'https://www.carleton.edu/student/orgs/sumo/schedule/?loadFeed=calendar'
const SUMO_PAGE = 'https://www.carleton.edu/student/orgs/sumo/schedule/'

void test('carletonCalendar pictures SUMO events from the schedule page', async (t) => {
	serveSumo(t)

	let events = await carletonCalendar(SUMO_FEED, SUMO_PAGE, moment.utc('2026-10-09T12:00:00Z'))

	t.assert.deepEqual(
		events.map((e) => [e.title, e.image]),
		[
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
		],
	)
})

void test('carletonCalendar asks the page for the next month in campus dates', async (t) => {
	let requested = serveSumo(t)

	// still the 9th on campus, though the 10th in UTC
	await carletonCalendar(SUMO_FEED, SUMO_PAGE, moment.utc('2026-10-10T03:00:00Z'))

	t.assert.equal(
		requested.find((url) => url.startsWith(SUMO_PAGE) && !url.includes('loadFeed')),
		`${SUMO_PAGE}?start_date=2026-10-09&end_date=2026-11-09`,
	)
})

void test('carletonCalendar keeps the events when the page fails', async (t) => {
	t.mock.method(console, 'error', () => undefined)
	serveSumo(t, () => new Response('gone', {status: 404}))

	let events = await carletonCalendar(SUMO_FEED, SUMO_PAGE, moment.utc('2026-10-09T12:00:00Z'))

	t.assert.equal(events.length, 3)
	t.assert.deepEqual(
		events.filter((e) => 'image' in e),
		[],
	)
})
