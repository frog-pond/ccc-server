import {env, exports} from 'cloudflare:workers'
import {afterEach, beforeEach, describe, expect, test, vi, type MockInstance} from 'vitest'
import {
	livestatsUrlFromScoresUrl,
	scoresFromFeeds,
	yesterdayCalendarUrl,
} from '../../source/athletics/shape.ts'
import {CAMPUSES} from '../src/campuses.ts'
import {clock} from '../src/clock.ts'
import {athleticsScores} from '../src/sources/athletics.ts'
import {spyOnFetch} from './spy.ts'
import scoresRaw from '../../source/athletics/fixtures/2026-09-26-home-games/20260926T180044Z-scores.json?raw'
import livestatsRaw from '../../source/athletics/fixtures/2026-09-26-home-games/20260926T180044Z-livestats.json?raw'

const get = (path: string) => exports.default.fetch(new Request(`https://worker.test${path}`))

const json = (body: string, status = 200) =>
	new Response(body, {status, headers: {'content-type': 'application/json'}})

// a recorded minute with games under way, moved to 2030 so no refresh alarm
// comes due while a test runs
const SCORES = scoresRaw.replaceAll('2026', '2030')
const LIVESTATS = livestatsRaw.replaceAll('2026', '2030')
const NOW = Date.parse('2030-09-26T18:00:44Z')

const STOLAF = CAMPUSES.get('edu.stolaf')?.athletics
const CARLETON = CAMPUSES.get('edu.carleton')?.athletics
if (!STOLAF || !CARLETON) throw new Error('both campuses list athletics')

let fetchSpy: MockInstance<typeof fetch>
let errorSpy: {mockRestore: () => void}

const feeds = (scores: string, livestats: string) => (input: RequestInfo | URL) => {
	let url = String(input)
	if (url.includes('scores_chris')) return Promise.resolve(json(scores))
	if (url.includes('livestats')) return Promise.resolve(json(livestats))
	return Promise.resolve(json('{}', 503))
}

beforeEach(async () => {
	clock.now = () => NOW
	for (let {scoresUrl} of [STOLAF, CARLETON]) {
		await env.SOURCE.getByName(`${athleticsScores.name}:${scoresUrl}`).purge()
	}
	fetchSpy = spyOnFetch()
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	fetchSpy.mockImplementation(feeds(SCORES, LIVESTATS))
})
afterEach(() => {
	fetchSpy.mockRestore()
	errorSpy.mockRestore()
})

const fetched = () => fetchSpy.mock.calls.map(([input]) => String(input))

describe('GET /athletics/scores', () => {
	test('is the games the Node server makes of the same feeds', async () => {
		let response = await get('/edu.stolaf/athletics/scores')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(
			scoresFromFeeds(JSON.parse(SCORES), JSON.parse(LIVESTATS), new Date(NOW)),
		)
	})

	test('reads the scores, livestats and yesterday’s calendar from the campus’s own site', async () => {
		await get('/edu.carleton/athletics/scores')
		expect(fetched().toSorted()).toEqual(
			[
				CARLETON.scoresUrl,
				livestatsUrlFromScoresUrl(CARLETON.scoresUrl),
				yesterdayCalendarUrl(CARLETON.scoresUrl, new Date(NOW)),
			].toSorted(),
		)
	})

	test('is kept for a minute while a game is under way', async () => {
		let response = await get('/edu.stolaf/athletics/scores')
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})

	test('is kept for five minutes with no game under way or about to start', async () => {
		fetchSpy.mockImplementation(feeds('{"scores": []}', '{"Games": []}'))
		let response = await get('/edu.stolaf/athletics/scores')
		expect(await response.json()).toEqual([])
		expect(response.headers.get('cache-control')).toBe('public, max-age=300')
	})

	test('a second request is served from the object', async () => {
		await get('/edu.stolaf/athletics/scores')
		await get('/edu.stolaf/athletics/scores')
		expect(fetched().filter((url) => url.includes('scores_chris'))).toHaveLength(1)
	})

	test('livestats failing only leaves out its scores', async () => {
		fetchSpy.mockImplementation(feeds(SCORES, '<html>down</html>'))
		let response = await get('/edu.stolaf/athletics/scores')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(scoresFromFeeds(JSON.parse(SCORES), null, new Date(NOW)))
	})

	test('the scores feed failing with nothing stored is a 502, briefly cacheable', async () => {
		fetchSpy.mockImplementation(feeds('<html>Just a moment</html>', LIVESTATS))
		let response = await get('/edu.stolaf/athletics/scores')
		expect(response.status).toBe(502)
		expect(response.headers.get('cache-control')).toBe('public, max-age=60')
	})

	test('a redirect is not followed', async () => {
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {status: 302, headers: {location: 'https://example.com/'}}),
			),
		)
		expect((await get('/edu.stolaf/athletics/scores')).status).toBe(502)
		expect(fetched()).not.toContain('https://example.com/')
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({redirect: 'manual'})
	})

	test('only the colleges’ athletics sites are fetched', async () => {
		let source = athleticsScores as unknown as {
			load: (p: {scoresUrl: string; teamName: string}) => Promise<unknown>
		}
		await expect(
			source.load({scoresUrl: 'https://example.com/scores?format=json', teamName: 'x'}),
		).rejects.toThrow('is not an athletics feed this reads')
		expect(fetched()).toEqual([])
	})
})
