import {test} from 'node:test'
import {JSDOM} from 'jsdom'
import {convertRssItemToStory} from './rss.ts'

/// One item as WordPress publishes it, namespaces and all.
function wordpressItem(inner: string) {
	const xml = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><item><title>Dryers Down</title><description>Short teaser</description>${inner}</item></channel>
</rss>`
	const item = new JSDOM(xml, {contentType: 'text/xml'}).window.document.querySelector('item')
	if (!item) throw new Error('no item')
	return item
}

void test('an RSS item names its dc:creator authors', (t) => {
	const story = convertRssItemToStory(
		wordpressItem('<dc:creator> Ole Olson</dc:creator><dc:creator>Lena Lund</dc:creator>'),
	)
	t.assert.deepEqual(story.authors, ['Ole Olson', 'Lena Lund'])
})

void test('an RSS item without an author is credited to Unknown Author', (t) => {
	const story = convertRssItemToStory(wordpressItem(''))
	t.assert.deepEqual(story.authors, ['Unknown Author'])
})

void test('an RSS item’s content is its content:encoded body', (t) => {
	const story = convertRssItemToStory(
		wordpressItem('<content:encoded><![CDATA[<p>The whole article.</p>]]></content:encoded>'),
	)
	t.assert.equal(story.content, 'The whole article.')
	t.assert.equal(story.excerpt, 'Short teaser')
})

void test('an RSS item without content:encoded falls back to its description', (t) => {
	const story = convertRssItemToStory(wordpressItem(''))
	t.assert.equal(story.content, 'Short teaser')
})
