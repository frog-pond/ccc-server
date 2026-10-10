import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {
	CONVOS_CALENDAR_URL,
	CONVOS_PODCAST_URL,
	archivedFrom,
	upcomingFrom,
} from '../../source/ccci-carleton-college/v1/convos-shape.ts'
import {clock} from '../src/clock.ts'
import {archivedConvos, convoDetail} from '../src/sources/convos.ts'
import {spyOnFetch} from './spy.ts'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const html = (body: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': 'text/html; charset=UTF-8'}})
const xml = (body: string) => new Response(body, {headers: {'content-type': 'text/xml'}})

const PAGE = `<html><body><div class="campus-calendar--event">
<div class="single_event_image"><a href="/convocations/speaker.jpg">photo</a></div>
<div class="event_description"><p>A talk about <a href="/rivers/">rivers</a>.</p></div>
<div class="sponsorContactInfo"><p>Sponsored by the Convocations Office</p></div>
</div></body></html>`

const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>Convos</title>
<item><title>A Talk</title><description>&lt;p&gt;About rivers&lt;/p&gt;</description>
<pubDate>Fri, 11 Jan 2030 16:00:00 +0000</pubDate>
<enclosure type="audio/mpeg" url="https://example.podbean.com/talk.mp3" length="123"/></item>
</channel></rss>`

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

beforeEach(async () => {
	clock.now = () => Date.parse('2030-01-15T18:00:00Z')
	for (let id of ['ut10', 'ut11']) await env.SOURCE.getByName(`${convoDetail.name}:${id}`).purge()
	await env.SOURCE.getByName(`${archivedConvos.name}:${CONVOS_PODCAST_URL}`).purge()
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation((input) =>
		Promise.resolve(String(input) === CONVOS_PODCAST_URL ? xml(FEED) : html(PAGE)),
	)
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const fetched = () => fetchSpy.mock.calls.map(([input]) => String(input))

describe('GET /edu.carleton/convos/upcoming/:id', () => {
	test('is the details the Node route makes of the event’s page', async () => {
		let response = await get('/edu.carleton/convos/upcoming/ut10')
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('public, max-age=600')
		expect(await response.json()).toEqual(upcomingFrom(PAGE))
		expect(fetched()).toEqual([`${CONVOS_CALENDAR_URL}?eId=ut10`])
	})

	test('a second request is served from the object', async () => {
		await get('/edu.carleton/convos/upcoming/ut11')
		await get('/edu.carleton/convos/upcoming/ut11')
		expect(fetched()).toHaveLength(1)
	})

	test('an id that is not a calendar code is a 404, with nothing fetched', async () => {
		for (let path of [
			'/edu.carleton/convos/upcoming/a%26b',
			'/edu.carleton/convos/upcoming/' + 'x'.repeat(33),
		]) {
			expect((await get(path)).status, path).toBe(404)
		}
		expect(fetched()).toEqual([])
	})

	test('a page without the event is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(html('<html>Just a moment</html>')))
		let response = await get('/edu.carleton/convos/upcoming/ut10')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})

	test('a redirect is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 302, headers: {location: 'https://example.com/'}}),
			),
		)
		expect((await get('/edu.carleton/convos/upcoming/ut10')).status).toBe(502)
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})
})

describe('GET /edu.carleton/convos/archived', () => {
	test('is the convocations the Node route makes of the podcast feed', async () => {
		let response = await get('/edu.carleton/convos/archived')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(JSON.parse(JSON.stringify(archivedFrom(FEED))))
		expect(fetched()).toEqual([CONVOS_PODCAST_URL])
	})

	test('an answer that is not the feed is a 502, not an empty list', async () => {
		fetchSpy.mockImplementation(() => Promise.resolve(html('<html>Just a moment</html>')))
		expect((await get('/edu.carleton/convos/archived')).status).toBe(502)
	})
})

test('the convocation details are not on St. Olaf’s table', async () => {
	expect((await get('/edu.stolaf/convos/archived')).status).toBe(404)
	expect((await get('/edu.stolaf/convos/upcoming/ut10')).status).toBe(404)
})
