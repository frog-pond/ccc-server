import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {feedItemsFrom} from './wp-json-shape.ts'

/// Three real posts from wp.stolaf.edu, and what `fetchWpJson` made of them
/// before its shaping moved out of the code that fetches. The Worker shares it.
const fixture = (name: string): unknown =>
	JSON.parse(
		readFileSync(new URL(`../../workers/test/fixtures/${name}`, import.meta.url), 'utf8'),
	) as unknown

void test('shapes WordPress posts into the feed items it always has', (t) => {
	t.assert.deepEqual(
		JSON.parse(JSON.stringify(feedItemsFrom(fixture('stolaf-posts.json')))),
		fixture('stolaf-news.json'),
	)
})

void test('refuses something that is not a list of posts', (t) => {
	t.assert.throws(() => feedItemsFrom({message: 'nope'}))
	t.assert.throws(() => feedItemsFrom([{id: 1}]))
})
