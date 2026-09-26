import {test} from 'node:test'
import {FIXTURES_DIR, readFixture} from '../../test/fixtures.ts'
import {BamcoPageContentsSchema} from './types-bonapp.ts'
import {extractBamco} from './extract-bamco.ts'

function stavHall(): string {
	let fixture = readFixture(
		FIXTURES_DIR,
		new URL('https://stolaf.cafebonappetit.com/cafe/stav-hall/'),
	)
	if (!fixture) throw new Error('missing Stav Hall fixture')
	return fixture.body.toString('utf8')
}

void test('a real café page yields data the Bamco schema accepts', (t) => {
	let bamco = BamcoPageContentsSchema.parse(extractBamco(stavHall()))
	if (!bamco) throw new Error('the Stav Hall fixture has no Bamco data')
	t.assert.equal(bamco.current_cafe.name, 'Stav Hall')
	t.assert.notEqual(Object.keys(bamco.menu_items).length, 0)
	t.assert.notEqual(Object.keys(bamco.dayparts).length, 0)
})

void test('a page with no Bamco assignments yields undefined', (t) => {
	t.assert.equal(extractBamco('<html><body>closed</body></html>'), undefined)
})

void test('a café name keeps HTML entities, as the page script leaves them', (t) => {
	let html = `<script>
Bamco = (typeof Bamco !== "undefined") ? Bamco : {};
Bamco.current_cafe = {
	name: 'The Kings&#039; Dining Room',
	id: 245            };
Bamco.menu_items = {};
Bamco.cor_icons = [];
</script>`
	t.assert.deepEqual(extractBamco(html), {
		current_cafe: {name: 'The Kings&#039; Dining Room', id: 245},
		menu_items: {},
		cor_icons: [],
		dayparts: {},
	})
})

void test('a café name with an escaped quote is unescaped', (t) => {
	let html = `<script>
Bamco.current_cafe = {
	name: 'Stav\\'s Hall',
	id: 1 };
Bamco.menu_items = {};
Bamco.cor_icons = [];
</script>`
	let bamco = extractBamco(html) as {current_cafe: {name: string}}
	t.assert.equal(bamco.current_cafe.name, "Stav's Hall")
})

void test('dayparts are collected by id', (t) => {
	let html = `<script>
Bamco.current_cafe = {
	name: 'X',
	id: 1 };
Bamco.menu_items = {};
Bamco.cor_icons = [];
Bamco.dayparts['1'] = {"id":"1","label":"Breakfast"};
Bamco.dayparts['3'] = {"id":"3","label":"Lunch"};
</script>`
	let bamco = extractBamco(html) as {dayparts: Record<string, {label: string}>}
	t.assert.deepEqual(Object.keys(bamco.dayparts), ['1', '3'])
	t.assert.equal(bamco.dayparts['3']?.label, 'Lunch')
})

void test('malformed JSON in an assignment throws rather than guessing', (t) => {
	let html = `<script>
Bamco.current_cafe = {
	name: 'X',
	id: 1 };
Bamco.menu_items = {"broken": };
</script>`
	t.assert.throws(() => extractBamco(html), SyntaxError)
})
