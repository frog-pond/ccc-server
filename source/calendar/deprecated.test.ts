import {test} from 'node:test'
import {deprecatedEvents, RETIRED_TITLE} from './deprecated.ts'

/// The clients that see these payloads are the ones that can no longer be
/// changed, so the shape matters as much as the words: an event row renders
/// `title` with `config.subtitle` beneath it, and hides the meaningless times.

void test('deprecatedEvents describes a retired source in one event', (t) => {
	let events = deprecatedEvents(RETIRED_TITLE, 'The Cave calendar is no longer published.')

	t.assert.equal(events.length, 1)

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	let event = events[0]!
	t.assert.equal(event.title, RETIRED_TITLE)
	t.assert.equal(event.description, 'The Cave calendar is no longer published.')
	t.assert.equal(event.dataSource, 'deprecated')
})

void test('deprecatedEvents hides times the reader cannot act on', (t) => {
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	let event = deprecatedEvents(RETIRED_TITLE, 'gone')[0]!

	t.assert.equal(event.config.startTime, false)
	t.assert.equal(event.config.endTime, false)
	t.assert.equal(event.config.subtitle, 'description')
})

void test('deprecatedEvents links somewhere the reader can find out why', (t) => {
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	let event = deprecatedEvents(RETIRED_TITLE, 'gone')[0]!

	t.assert.equal(event.links.length, 1)
	t.assert.match(String(event.links[0]), /^https:\/\//)
})

void test('deprecatedEvents distinguishes retired from temporarily unavailable', (t) => {
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	let event = deprecatedEvents('Temporarily unavailable', 'back soon')[0]!

	t.assert.equal(event.title, 'Temporarily unavailable')
	t.assert.notEqual(event.title, RETIRED_TITLE)
})
