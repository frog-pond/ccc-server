import {test} from 'node:test'
import {BamcoFormatError, extractBamco, unescapeJsString} from './extract-bamco.ts'

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

/// A page as BonApp writes it, with `current_cafe` as given.
function page(currentCafe: string, rest = ''): string {
	return [
		'<script>',
		'Bamco = (typeof Bamco !== "undefined") ? Bamco : {};',
		currentCafe,
		'Bamco.menu_items = {};',
		'Bamco.cor_icons = [];',
		'Bamco.dayparts = Bamco.dayparts || {};',
		'Bamco.dayparts[\'1\'] = {"id":"1","label":"Lunch"};',
		rest,
		'</script>',
	].join('\n')
}

void test('a current_cafe written some other way throws, rather than read as closed', (t) => {
	let drifted = page('Bamco.current_cafe = {\n\tname: "Stav Hall",\n\tid: 261};')
	t.assert.throws(() => extractBamco(drifted), BamcoFormatError)
})

void test('a daypart written over several lines throws, rather than be skipped', (t) => {
	let html = page(
		"Bamco.current_cafe = {\n\tname: 'X',\n\tid: 1};",
		'Bamco.dayparts[\'3\'] = {\n\t"id": "3",\n\t"label": "Dinner"\n};',
	)
	t.assert.throws(() => extractBamco(html), BamcoFormatError)
})

void test('a menu written over several lines throws, rather than be skipped', (t) => {
	let html = page("Bamco.current_cafe = {\n\tname: 'X',\n\tid: 1};").replace(
		'Bamco.menu_items = {};',
		'Bamco.menu_items = {\n};',
	)
	t.assert.throws(() => extractBamco(html), BamcoFormatError)
})

void test('a comparison with a Bamco value is not counted as an assignment', (t) => {
	let html = page(
		"Bamco.current_cafe = {\n\tname: 'X',\n\tid: 1};",
		'if (Bamco.menu_items == null) {}',
	)
	t.assert.doesNotThrow(() => extractBamco(html))
})

void test('reading a daypart is not counted as an assignment', (t) => {
	let html = page(
		"Bamco.current_cafe = {\n\tname: 'X',\n\tid: 1};",
		"if (Bamco.dayparts['1'].label === Bamco.dayparts[id]) {}",
	)
	t.assert.doesNotThrow(() => extractBamco(html))
})

void test('JSON with a line separator inside a string is read whole', (t) => {
	let separator = String.fromCharCode(0x2028)
	let html = page("Bamco.current_cafe = {\n\tname: 'X',\n\tid: 1};").replace(
		'Bamco.menu_items = {};',
		`Bamco.menu_items = {"1":{"label":"a${separator}b"}};`,
	)
	let bamco = extractBamco(html) as {menu_items: Record<string, {label: string}>}
	t.assert.equal(bamco.menu_items['1']?.label, `a${separator}b`)
})

void test('a café name is read as the page script would read it', (t) => {
	let html = page(
		"Bamco.current_cafe = {\n\tname: 'Caf\\u00e9 \\x27Stav\\x27\\tHall\\\\',\n\tid: 1};",
	)
	let bamco = extractBamco(html) as {current_cafe: {name: string}}
	t.assert.equal(bamco.current_cafe.name, "Café 'Stav'\tHall\\")
})

void test('unescapeJsString decodes each kind of escape', (t) => {
	t.assert.equal(unescapeJsString(String.raw`\n\t\'\"\\\0`), '\n\t\'"\\\0')
	t.assert.equal(unescapeJsString(String.raw`é\x41\u{1F600}`), 'éA\u{1F600}')
	t.assert.equal(unescapeJsString('a\\\nb'), 'ab', 'a line continuation')
	t.assert.equal(unescapeJsString(String.raw`\q`), 'q', 'an escape that means nothing')
})
