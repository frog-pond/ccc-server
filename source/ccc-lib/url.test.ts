import {test} from 'node:test'
import {makeAbsoluteUrl} from './url.ts'
import {htmlToMarkdown} from './html-to-markdown.ts'

const baseUrl = 'https://www.carleton.edu/convocations/calendar/'

void test('a root-relative link resolves against the site', (t) => {
	t.assert.equal(makeAbsoluteUrl('/events/x/', {baseUrl}), 'https://www.carleton.edu/events/x')
})

void test('a page-relative link resolves beside the page', (t) => {
	t.assert.equal(
		makeAbsoluteUrl('speaker.jpg', {baseUrl}),
		'https://www.carleton.edu/convocations/calendar/speaker.jpg',
	)
})

void test('a protocol-relative link keeps its own host', (t) => {
	t.assert.equal(
		makeAbsoluteUrl('//cdn.example.com/a.png', {baseUrl}),
		'https://cdn.example.com/a.png',
	)
})

void test('a mailto link is left a mailto link', (t) => {
	t.assert.equal(makeAbsoluteUrl('mailto:x@y.z', {baseUrl}), 'mailto:x@y.z')
})

void test('an absolute link is kept', (t) => {
	t.assert.equal(makeAbsoluteUrl('https://a.com/b', {baseUrl}), 'https://a.com/b')
})

void test('a relative link with no base is left as written', (t) => {
	t.assert.equal(makeAbsoluteUrl('/about'), '/about')
})

void test('html-to-markdown handles relative and mailto links without a base', (t) => {
	t.assert.equal(
		htmlToMarkdown('<a href="/about">About</a> <a href="mailto:x@y.z">Mail</a>'),
		'[About](/about) [Mail](mailto:x@y.z)',
	)
})
