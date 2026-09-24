import {test} from 'node:test'
import {htmlToMarkdown} from './html-to-markdown.ts'

void test('headings use atx style and lists use dashes', (t) => {
	t.assert.equal(htmlToMarkdown('<h2>Hi</h2><ul><li>one</li></ul>'), '## Hi\n\n-   one')
})

void test('relative links become absolute against the base url', (t) => {
	t.assert.equal(
		htmlToMarkdown('<p>see <a href="/x" title="X">this</a></p>', {
			baseUrl: 'https://www.carleton.edu/convocations/',
		}),
		'see [this](https://www.carleton.edu/x "X")',
	)
})

void test('absolute links are kept', (t) => {
	t.assert.equal(
		htmlToMarkdown('<a href="https://example.com/a">a</a>'),
		'[a](https://example.com/a)',
	)
})
