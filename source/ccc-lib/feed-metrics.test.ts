import {test} from 'node:test'
import {countedLoad, feedName} from './feed-metrics.ts'

void test('a feed is named by its host and path, never its query', (t) => {
	t.assert.equal(
		feedName('https://stolaf.cafebonappetit.com/cafe/stav-hall/?key=secret'),
		'stolaf.cafebonappetit.com/cafe/stav-hall/',
	)
	t.assert.equal(feedName(new URL('https://example.com:8443/a.ics')), 'example.com:8443/a.ics')
	t.assert.equal(feedName('not a url'), 'unknown')
})

void test('a counted load hands back what it loaded, and rethrows what it failed with', async (t) => {
	t.assert.deepEqual(await countedLoad('test', 'feed', () => Promise.resolve([1, 2])), [1, 2])
	let failure = new Error('upstream down')
	await t.assert.rejects(
		countedLoad('test', 'feed', () => Promise.reject(failure)),
		(error) => error === failure,
	)
})
