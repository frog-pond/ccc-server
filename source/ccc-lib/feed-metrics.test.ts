import {test} from 'node:test'
import {feedName, recordFeedFailure, recordFeedItems} from './feed-metrics.ts'
import {captureMetrics, takeMetrics} from './metrics-testing.ts'

const seen = captureMetrics()

void test('a feed is named by its host and path, never its query', (t) => {
	t.assert.equal(
		feedName('https://stolaf.cafebonappetit.com/cafe/stav-hall/?key=secret'),
		'stolaf.cafebonappetit.com/cafe/stav-hall/',
	)
	t.assert.equal(feedName(new URL('https://example.com:8443/a.ics')), 'example.com:8443/a.ics')
	t.assert.equal(feedName('not a url'), 'unknown')
})

void test('a load of a feed is told with its item count, source and feed', (t) => {
	recordFeedItems('bonapp', 'example.com/cafe/', 12)
	recordFeedItems('bonapp', 'example.com/cafe/', 0, {closed: true})
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [
		[12, {source: 'bonapp', feed: 'example.com/cafe/'}],
		[0, {closed: true, source: 'bonapp', feed: 'example.com/cafe/'}],
	])
})

void test('a failed load of a feed is counted', (t) => {
	recordFeedFailure('ical', 'example.com')
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [
		[1, {source: 'ical', feed: 'example.com'}],
	])
})
