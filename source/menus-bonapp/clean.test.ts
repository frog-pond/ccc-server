import {test} from 'node:test'
import {
	cleanDayPart,
	cleanMenuItem,
	itemDescription,
	itemLabel,
	stationName,
	subStationName,
	textOf,
} from './clean.ts'

void test('a station loses its <strong>@ wrapper and is title-cased', (t) => {
	t.assert.equal(stationName('<strong>@leaves & greens</strong>'), 'Leaves & Greens')
})

void test("a daypart's bare station label cleans to its items' station name", (t) => {
	t.assert.equal(stationName('leaves & greens'), stationName('<strong>@leaves & greens</strong>'))
})

void test('entities are decoded before title-casing, so & never reads "&Amp;"', (t) => {
	t.assert.equal(stationName('<strong>@mac &amp; cheese</strong>'), 'Mac & Cheese')
	t.assert.equal(itemLabel('cr&egrave;me br&ucirc;l&eacute;e'), 'Crème Brûlée')
	t.assert.equal(subStationName('soups &amp; stews'), 'Soups & Stews')
})

void test('a label loses its trailing tags in parentheses, however many', (t) => {
	t.assert.equal(itemLabel('chocolate sauce (Monin)'), 'Chocolate Sauce')
	t.assert.equal(itemLabel('fish  &amp; chips   (gf) (v)'), 'Fish & Chips')
})

void test('a parenthetical inside a label stays', (t) => {
	t.assert.equal(itemLabel('soup (of the day) special'), 'Soup (Of the Day) Special')
})

void test('a description is plain text, its blocks kept apart', (t) => {
	t.assert.equal(
		itemDescription('<p>with <b>herbs</b>&nbsp;and oil</p><br>served hot'),
		'with herbs and oil served hot',
	)
	t.assert.equal(itemDescription(''), '')
})

void test('inline tags inside a word do not split it', (t) => {
	t.assert.equal(textOf('<b>W</b>affles'), 'Waffles')
})

/// Builds already shipped clean what they receive a second time, so the
/// server's output has to come through its own cleaning unchanged.
void test('every cleaning leaves cleaned text alone', (t) => {
	let corpus = [
		'<strong>@leaves & greens</strong>',
		'<strong>@mac &amp; cheese</strong>',
		'fish  &amp; chips   (gf) (v)',
		'add Lemon Lime Soda (Starry)',
		'BBQ chicken sandwich',
		'<p>with <b>herbs</b>&nbsp;and oil</p><br>served hot',
		'Rich &amp; creamy &lt;3',
	]
	for (let clean of [stationName, subStationName, itemLabel, itemDescription]) {
		for (let raw of corpus) {
			let once = clean(raw)
			t.assert.equal(clean(once), once, `${clean.name}(${raw})`)
		}
	}
})

void test('cleanMenuItem cleans the text fields and keeps the rest', (t) => {
	let item = cleanMenuItem({
		id: '42',
		station: '<strong>@grill</strong>',
		sub_station: 'burgers',
		label: 'cheeseburger (beef)',
		description: '<p>on a bun</p>',
		rating: '5',
	})
	t.assert.deepEqual(item, {
		id: '42',
		station: 'Grill',
		sub_station: 'Burgers',
		label: 'Cheeseburger',
		description: 'on a bun',
		rating: '5',
	})
})

void test('cleanDayPart cleans its stations’ labels the same way', (t) => {
	let daypart = cleanDayPart({label: 'Lunch', stations: [{label: 'grill', items: ['42']}]})
	t.assert.deepEqual(daypart, {label: 'Lunch', stations: [{label: 'Grill', items: ['42']}]})
})
