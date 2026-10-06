import {test} from 'node:test'
import {fetchRssFeed} from '../feeds/rss.ts'
import {fetchWpJson} from '../feeds/wp-json.ts'
import {presence} from '../student-orgs/presence.ts'
import {getAllJobs} from '../ccci-carleton-college/v1/jobs.ts'
import {fetchAthleticsScores} from '../athletics/index.ts'
import {captureMetrics, takeMetrics} from './metrics-testing.ts'

// Each feed source tells Sentry how many items a load gave, or that it failed,
// named so that one feed can be told from another.

const seen = captureMetrics()

/// Answers each request with what `answer` gives for its URL: a body, or a
/// status to fail with.
function serve(t: test.TestContext, answer: (url: URL) => string | number) {
	t.mock.method(globalThis, 'fetch', (input: Parameters<typeof fetch>[0]) => {
		let url = new URL(input instanceof Request ? input.url : String(input))
		let body = answer(url)
		return Promise.resolve(
			typeof body === 'number' ? new Response(null, {status: body}) : new Response(body),
		)
	})
}

const RSS = `<rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item><title>One</title><link>https://news.example.edu/1</link></item>
<item><title>Two</title><link>https://news.example.edu/2</link></item>
</channel></rss>`

void test('an RSS feed is told with its story count', async (t) => {
	serve(t, () => RSS)
	let stories = await fetchRssFeed('https://news.example.edu/feed/', {page: '2'})
	t.assert.equal(stories.length, 2)
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [
		[2, {source: 'rss', feed: 'news.example.edu/feed/'}],
	])
})

void test('an RSS feed that fails is counted, though it answers with no stories', async (t) => {
	serve(t, () => 404)
	t.mock.method(console, 'error', () => undefined)
	t.assert.deepEqual(await fetchRssFeed('https://news.example.edu/feed/'), [])
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [])
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [
		[1, {source: 'rss', feed: 'news.example.edu/feed/'}],
	])
})

void test('a WordPress feed is told with its story count, and counted when it fails', async (t) => {
	let answer: string | number = '[]'
	serve(t, () => answer)
	await fetchWpJson('https://news.example.edu/wp-json/wp/v2/posts')
	answer = '{"code": "rest_no_route"}'
	await t.assert.rejects(fetchWpJson('https://news.example.edu/wp-json/wp/v2/posts'))

	let feed = {source: 'wp-json', feed: 'news.example.edu/wp-json/wp/v2/posts'}
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [[0, feed]])
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [[1, feed]])
})

void test('Presence is told with its org count, by school', async (t) => {
	serve(t, (url) =>
		url.pathname.endsWith('/app/campus')
			? JSON.stringify({apiId: 'campus', cdn: 'https://stolaf-cdn.presence.io'})
			: '[]',
	)
	await presence('stolaf')
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [[0, {source: 'presence', feed: 'stolaf'}]])
})

void test('Presence is counted when it fails', async (t) => {
	serve(t, () => 404)
	await t.assert.rejects(presence('stolaf'))
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [[1, {source: 'presence', feed: 'stolaf'}]])
})

void test('Carleton jobs are told with their count, and counted when they fail', async (t) => {
	let answer: string | number = '[]'
	serve(t, () => answer)
	await getAllJobs()
	answer = 404
	await t.assert.rejects(getAllJobs())

	let feed = {
		source: 'wp-jobs',
		feed: 'www.carleton.edu/student-employment/post-jobs/wp-json/wp/v2/posts',
	}
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [[0, feed]])
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [[1, feed]])
})

void test('athletics scores are told with their count, and counted when they fail', async (t) => {
	let answer: string | number = JSON.stringify({scores: []})
	serve(t, (url) => (url.pathname.endsWith('scores_chris.aspx') ? answer : 404))
	let url = 'https://athletics.example.edu/services/scores_chris.aspx?format=json'
	await fetchAthleticsScores(url, 'Oles')
	answer = 404
	await t.assert.rejects(fetchAthleticsScores(url, 'Oles'))

	let feed = {source: 'athletics', feed: 'athletics.example.edu/services/scores_chris.aspx'}
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [[0, feed]])
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [[1, feed]])
})
