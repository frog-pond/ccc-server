import {test} from 'node:test'
import {feedName} from './feed-metrics.ts'

void test('a feed is named by its host and path, never its query', (t) => {
	t.assert.equal(
		feedName('https://stolaf.cafebonappetit.com/cafe/stav-hall/?key=secret'),
		'stolaf.cafebonappetit.com/cafe/stav-hall/',
	)
	t.assert.equal(feedName(new URL('https://example.com:8443/a.ics')), 'example.com:8443/a.ics')
	t.assert.equal(feedName('not a url'), 'unknown')
})
