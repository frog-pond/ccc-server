import {test} from 'node:test'

import {FIXTURES_DIR, readFixture} from '../../test/fixtures.ts'
import {cafe, cafeFromHtml, menu as bonAppMenu, menuFromHtml} from './index.ts'
import {campusToday} from './helpers.ts'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.ts'

function stavHall(): string {
	let fixture = readFixture(
		FIXTURES_DIR,
		new URL('https://stolaf.cafebonappetit.com/cafe/stav-hall/'),
	)
	if (!fixture) throw new Error('missing Stav Hall fixture')
	return fixture.body.toString('utf8')
}

void test('cafe info from a real page parses as CafeInfoResponseSchema', (t) => {
	t.assert.doesNotThrow(() => CafeInfoResponseSchema.parse(cafeFromHtml(stavHall())))
})

void test('menu from a real page parses as CafeMenuResponseSchema', (t) => {
	t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(menuFromHtml(stavHall())))
})

void test('cafe info names the café', (t) => {
	t.assert.equal(cafeFromHtml(stavHall()).cafe.name, 'Stav Hall')
})

void test('a page with no Bamco data reads as a closed café', (t) => {
	let info = cafeFromHtml('<html><body></body></html>')
	t.assert.equal(info.cafe.message, 'Café is closed')
})

void test('a page with no Bamco data reads as a closed menu', (t) => {
	let menu = menuFromHtml('<html><body></body></html>')
	t.assert.equal(menu.items['1']?.label, 'Closed')
})

// The dayparts are the ones BonApp's page shows for today, which is today on
// campus -- including in the evening, when UTC has already moved on.
void test('cafe info is dated by the campus calendar', (t) => {
	t.assert.equal(cafeFromHtml(stavHall()).cafe.days[0]?.date, campusToday())
})

void test('menu info is dated by the campus calendar', (t) => {
	t.assert.equal(menuFromHtml(stavHall()).days[0]?.date, campusToday())
})

// Port 1 on loopback refuses connections, so the fetch fails for real.
const UNREACHABLE = 'http://127.0.0.1:1/cafe/'

void test('a café that cannot be fetched answers with a message instead of throwing', async (t) => {
	let logged = t.mock.method(console, 'error', () => undefined)
	let info = await cafe(UNREACHABLE)
	t.assert.equal(info.fallback, true)
	t.assert.equal(info.data.cafe.message, 'Could not load café from BonApp')
	t.assert.equal(logged.mock.callCount(), 1)
	t.assert.deepEqual(logged.mock.calls[0]?.arguments[1], {cafeUrl: UNREACHABLE})
})

void test('a menu that cannot be fetched answers with an error menu instead of throwing', async (t) => {
	let logged = t.mock.method(console, 'error', () => undefined)
	let menu = await bonAppMenu(UNREACHABLE)
	t.assert.equal(menu.fallback, true)
	t.assert.equal(menu.data.items['1']?.label, 'Could not load the BonApp menu data')
	t.assert.equal(logged.mock.callCount(), 1)
	t.assert.deepEqual(logged.mock.calls[0]?.arguments[1], {cafeUrl: UNREACHABLE})
})
