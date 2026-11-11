import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {extractBamco} from './extract-bamco.ts'
import {cafeFrom, cafeUrlForDate, menuDates, menuFrom, menuFromPages} from './shape.ts'
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

void test('menu dates run on from today, across a month end', (t) => {
	t.assert.deepEqual(menuDates('2026-10-30', 5), [
		'2026-10-30',
		'2026-10-31',
		'2026-11-01',
		'2026-11-02',
		'2026-11-03',
	])
})

void test("a café page's address for a date replaces any date already in it", (t) => {
	const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'
	t.assert.equal(cafeUrlForDate(STAV, DATE), `${STAV}${DATE}/`)
	t.assert.equal(cafeUrlForDate(`${STAV}2020-01-01/`, DATE), `${STAV}${DATE}/`)
})

void test('one day that could not be loaded does not cost the others', (t) => {
	let menu = menuFromPages([
		{date: '2026-09-22', page: {status: 'fulfilled', value: page}},
		{date: '2026-09-23', page: {status: 'rejected', reason: new Error('BonApp responded 503')}},
	])
	t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(menu))
	t.assert.deepEqual(
		menu.days.map(({date}) => date),
		['2026-09-22', '2026-09-23'],
	)
	t.assert.equal(menu.days[1]?.cafe.dayparts[0]?.[0]?.label, 'Errored')
	t.assert.equal(
		Object.keys(menuFrom(page, DATE).items).every((id) => id in menu.items),
		true,
	)
})

void test('when no day could be loaded, the failure is thrown', (t) => {
	let failure = new Error('BonApp responded 503')
	t.assert.throws(
		() =>
			menuFromPages([
				{date: '2026-09-22', page: {status: 'rejected', reason: failure}},
				{date: '2026-09-23', page: {status: 'rejected', reason: new Error('later')}},
			]),
		failure,
	)
})

void test("every day's items and icons are kept", (t) => {
	if (page === null || Array.isArray(page.cor_icons)) throw new Error('the fixture has no icons')
	let [item] = Object.values(page.menu_items)
	let [icon] = Object.values(page.cor_icons)
	if (!item || !icon) throw new Error('the fixture has no items or icons')
	// a page with one item and one icon, both under `id`
	let only = (id: string) => ({
		...page,
		menu_items: {[id]: {...item, id}},
		cor_icons: {[id]: {...icon, id}},
	})
	let menu = menuFromPages([
		{date: '2026-09-22', page: {status: 'fulfilled', value: only('101')}},
		{date: '2026-09-23', page: {status: 'fulfilled', value: only('202')}},
	])
	t.assert.deepEqual(Object.keys(menu.items).sort(), ['101', '202'])
	t.assert.deepEqual(Object.keys(menu.cor_icons).sort(), ['101', '202'])
})
