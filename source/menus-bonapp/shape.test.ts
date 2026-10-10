import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {extractBamco} from './extract-bamco.ts'
import {cafeFrom, itemFrom, menuFrom} from './shape.ts'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.ts'
import {BamcoPageContentsSchema} from './types-bonapp.ts'

const DATE = '2026-09-22'

/// A real Stav Hall page, trimmed, and what `_menu` and `_cafe` made of it before
/// their shaping moved out of the code that fetches. The Worker shares both.
const fixture = (name: string) =>
	readFileSync(new URL(`../../workers/test/fixtures/${name}`, import.meta.url), 'utf8')
const golden = (name: string): unknown =>
	JSON.parse(fixture(name).replaceAll('$DATE', DATE)) as unknown

const page = BamcoPageContentsSchema.parse(extractBamco(fixture('stav-hall.html'))) ?? null

void test('shapes a café page into the menu it always has', (t) => {
	let menu = menuFrom(page, DATE)
	t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(menu))
	t.assert.deepEqual(JSON.parse(JSON.stringify(menu)), golden('stav-hall.menu.json'))
})

void test('shapes a café page into the café info it always has', (t) => {
	let cafe = cafeFrom(page, DATE)
	t.assert.doesNotThrow(() => CafeInfoResponseSchema.parse(cafe))
	t.assert.deepEqual(JSON.parse(JSON.stringify(cafe)), golden('stav-hall.cafe.json'))
})

void test('dates the response by the date it is given', (t) => {
	t.assert.equal(menuFrom(page, '2031-01-02').days[0]?.date, '2031-01-02')
	t.assert.equal(cafeFrom(page, '2031-01-02').cafe.days[0]?.date, '2031-01-02')
})

void test('a closed café is a closed menu, dated', (t) => {
	let menu = menuFrom(null, DATE)
	t.assert.equal(menu.days[0]?.date, DATE)
	t.assert.equal(menu.items['1']?.label, 'Closed')
})

void test('a closed café has café info saying so, dated', (t) => {
	let cafe = cafeFrom(null, DATE)
	t.assert.equal(cafe.cafe.message, 'Café is closed')
	t.assert.equal(cafe.cafe.days[0]?.date, DATE)
})

void test('an empty list of icons, as BonApp sends when there are none, is no icons', (t) => {
	if (page === null) throw new Error('the fixture is a closed café')
	let menu = menuFrom({...page, cor_icons: []}, DATE)
	t.assert.deepEqual(menu.cor_icons, {})
})

const goldenItems = (golden('stav-hall.menu.json') as {items: Record<string, unknown>}).items

void test('finds one item, cleaned the way the menu has it', (t) => {
	let [id] = Object.keys(goldenItems)
	if (id === undefined) throw new Error('the fixture has no items')
	t.assert.deepEqual(JSON.parse(JSON.stringify(itemFrom(page, id))), goldenItems[id])
})

void test('an item the page does not have is undefined', (t) => {
	t.assert.equal(itemFrom(page, '1'), undefined)
	t.assert.equal(itemFrom(page, 'toString'), undefined)
})

void test('a closed café has no items', (t) => {
	let [id] = Object.keys(goldenItems)
	t.assert.equal(itemFrom(null, id ?? ''), undefined)
})
