import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {unitNumber, unitNumberOfDescription} from './unit-number.ts'

function descriptionOf(name: string): string {
	let body = JSON.parse(
		readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'),
	) as {
		items: {ExternalDescriptionStr?: string | null}[]
	}
	return body.items[0]?.ExternalDescriptionStr ?? ''
}

void test('unitNumber reads a plain five-digit unit', (t) => {
	t.assert.equal(unitNumber('11725'), '11725')
})

void test('unitNumber drops a two- or three-digit fund prefix', (t) => {
	t.assert.equal(unitNumber('10-13001'), '13001')
	t.assert.equal(unitNumber('010-11725'), '11725')
})

void test('unitNumber reads the unit after an account-string prefix', (t) => {
	t.assert.equal(unitNumber('41066-11300'), '11300')
	t.assert.equal(unitNumber('45452-11565.'), '11565')
	t.assert.equal(unitNumber('41203-11184-53000-00512'), '11184')
})

void test('unitNumber takes the first of two units', (t) => {
	t.assert.equal(unitNumber('10-13001 / 10-13000'), '13001')
})

void test('unitNumber ignores zero-width characters and spaces', (t) => {
	t.assert.equal(unitNumber('\u200B 11150 '), '11150')
})

void test('unitNumber stops at the fifth digit when text follows', (t) => {
	t.assert.equal(unitNumber('11725Length of Position'), '11725')
})

void test('unitNumber is null for anything else', (t) => {
	for (let value of ['', 'n/a', '11-707', '1172', '117250', 'Length of Position: See']) {
		t.assert.equal(unitNumber(value), null, JSON.stringify(value))
	}
})

void test('unitNumberOfDescription reads each saved posting', (t) => {
	let expected: Record<string, string | null> = {
		'detail-standard': '11725',
		'detail-summer': '11727',
		'detail-roman-numerals': '15141',
		'detail-no-description-label': '16322',
		'detail-fund-prefix': '11725',
		'detail-two-units': '13001',
		'detail-zero-width': '11150',
		'detail-mistyped-unit': null,
		'detail-unit-na': null,
		'detail-blank-unit': null,
		'detail-no-unit-label': null,
	}
	for (let [name, unit] of Object.entries(expected)) {
		t.assert.equal(unitNumberOfDescription(descriptionOf(name)), unit, name)
	}
})

/// With no whitespace between paragraphs, the next paragraph's digits must
/// not run on into the unit.
void test('unitNumberOfDescription keeps a unit apart from the paragraph after it', (t) => {
	let html = '<p><strong>Unit Number:</strong> 11725</p><p>2026-27 academic year</p>'

	t.assert.equal(unitNumberOfDescription(html), '11725')
})

void test('a unit written with an entity inside it is still read whole', (t) => {
	t.assert.equal(unitNumberOfDescription('Unit Number: 10-13&#8203;001'), '13001')
})
