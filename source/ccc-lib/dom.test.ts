import {test} from 'node:test'
import {parseHtml, parseXml, textFromHtml} from './dom.ts'

const RSS = `<?xml version="1.0"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item>
<title><![CDATA[Tom &amp; Jerry <b>bold</b>]]></title>
<link>https://example.com/a</link>
<dc:creator>Ann</dc:creator>
<pubDate>Tue, 22 Sep 2026 10:00:00 GMT</pubDate>
<enclosure url="https://example.com/i.jpg" type="image/jpeg"/>
<description>Caf&#233; &amp; more</description>
</item></channel></rss>`

void test('parseXml keeps <link> text, which an HTML parser drops', (t) => {
	let doc = parseXml(RSS)
	t.assert.equal(doc.querySelector('item link')?.textContent, 'https://example.com/a')
})

void test('parseXml unwraps CDATA', (t) => {
	let doc = parseXml(RSS)
	t.assert.equal(doc.querySelector('item title')?.textContent, 'Tom &amp; Jerry <b>bold</b>')
})

void test('parseXml decodes entities in text', (t) => {
	let doc = parseXml(RSS)
	t.assert.equal(doc.querySelector('item description')?.textContent, 'Café & more')
})

/// typed-query-selector can't read an escaped colon, so the list is typed here
function textsOf(elements: NodeListOf<Element>) {
	return Array.from(elements, (el) => el.textContent)
}

void test('parseXml matches camelCase and namespaced element names', (t) => {
	let item = parseXml(RSS).querySelector('item')
	if (!item) throw new Error('the fixture has no item')
	t.assert.equal(item.querySelector('pubDate')?.textContent, 'Tue, 22 Sep 2026 10:00:00 GMT')
	t.assert.deepEqual(textsOf(item.querySelectorAll('dc\\:creator')), ['Ann'])
	t.assert.equal(item.querySelector('enclosure')?.getAttribute('url'), 'https://example.com/i.jpg')
})

void test('parseHtml supports the selectors the scrapers use', (t) => {
	let doc = parseHtml(
		'<div id="jobs"><h3>Title</h3><ul><li>a</li><li>b</li></ul><ul><li>c</li></ul></div>',
	)
	t.assert.equal(doc.querySelectorAll('#jobs ul:first-of-type > li').length, 2)
	t.assert.equal(doc.querySelector('#jobs h3')?.textContent, 'Title')
})

void test('textFromHtml removes tags and decodes entities', (t) => {
	t.assert.equal(textFromHtml('<p>Hello <b>world</b> &amp; co</p>'), 'Hello world & co')
})

void test('textFromHtml decodes named and numeric entities', (t) => {
	t.assert.equal(textFromHtml('Caf&eacute; &#233;'), 'Café é')
})

void test('textFromHtml trims surrounding whitespace', (t) => {
	t.assert.equal(textFromHtml('  plain  '), 'plain')
})

void test('textFromHtml returns an empty string for empty input', (t) => {
	t.assert.equal(textFromHtml(''), '')
})
