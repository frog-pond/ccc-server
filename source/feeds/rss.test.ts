import {test} from 'node:test'
import {parseXml} from '../ccc-lib/dom.ts'
import {convertRssItemToStory} from './rss.ts'

const ITEM = `<?xml version="1.0"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item>
<title><![CDATA[Tom &amp; Jerry]]></title>
<link>https://example.com/a</link>
<dc:creator>Ann</dc:creator>
<category>News</category>
<pubDate>Tue, 22 Sep 2026 10:00:00 GMT</pubDate>
<enclosure url="https://example.com/i.jpg" type="image/jpeg"/>
<description>&lt;p&gt;Caf&amp;eacute; opens&lt;/p&gt;</description>
</item></channel></rss>`

function item() {
	let el = parseXml(ITEM).querySelector('item')
	if (!el) throw new Error('the fixture has no item')
	return el
}

void test('an RSS item keeps its link', (t) => {
	t.assert.equal(convertRssItemToStory(item()).link, 'https://example.com/a')
})

void test('an RSS item title has entities decoded', (t) => {
	t.assert.equal(convertRssItemToStory(item()).title, 'Tom & Jerry')
})

void test('an RSS item reads its authors, categories, date, and image', (t) => {
	let story = convertRssItemToStory(item())
	t.assert.deepEqual(story.authors, ['Ann'])
	t.assert.deepEqual(story.categories, ['News'])
	t.assert.equal(story.datePublished, '2026-09-22T10:00:00.000Z')
	t.assert.equal(story.featuredImage, 'https://example.com/i.jpg')
})

void test('an RSS item description becomes plain text', (t) => {
	let story = convertRssItemToStory(item())
	t.assert.equal(story.content, 'Café opens')
	t.assert.equal(story.excerpt, 'Café opens')
})
