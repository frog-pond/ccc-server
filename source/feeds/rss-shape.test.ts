import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {feedItemsFromRss} from './rss-shape.ts'

/// Three real items from thecarletonian.com's feed, and what `fetchRssFeed` made
/// of them before its shaping moved out of the code that fetches. The Worker
/// shares it.
const fixture = (name: string) =>
	readFileSync(new URL(`../../workers/test/fixtures/${name}`, import.meta.url), 'utf8')

void test('shapes an RSS feed into the feed items it always has', (t) => {
	t.assert.deepEqual(
		JSON.parse(JSON.stringify(feedItemsFromRss(fixture('carletonian-feed.xml')))),
		JSON.parse(fixture('carletonian.json')),
	)
})

void test('a feed with no items is no items', (t) => {
	let empty = '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>'
	t.assert.deepEqual(feedItemsFromRss(empty), [])
})

void test('something that is not XML throws, rather than reading as an empty feed', (t) => {
	t.assert.throws(() => feedItemsFromRss('<html><body>Just a moment...'))
	t.assert.throws(() => feedItemsFromRss(''))
})
