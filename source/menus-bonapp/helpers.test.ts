import {test} from 'node:test'

import {CafeMenuIsClosed, CafeMenuWithError, CustomCafe, campusToday} from './helpers.ts'

void test('dates an evening by the campus calendar, not the UTC one', (t) => {
	// 7:36 PM CDT on the 22nd is already the 23rd in UTC.
	t.assert.equal(campusToday(new Date('2026-09-23T00:36:00Z')), '2026-09-22')
})

void test('dates a winter evening by the campus calendar', (t) => {
	// 7 PM CST on 14 December is already the 15th in UTC.
	t.assert.equal(campusToday(new Date('2026-12-15T01:00:00Z')), '2026-12-14')
})

void test('dates the small hours by the day they belong to', (t) => {
	// 12:30 AM CDT on the 23rd.
	t.assert.equal(campusToday(new Date('2026-09-23T05:30:00Z')), '2026-09-23')
})

void test('dates a stand-in cafe by the campus calendar', (t) => {
	t.assert.equal(CustomCafe('Café is closed').cafe.days[0]?.date, campusToday())
})

void test('dates a closed menu by the campus calendar', (t) => {
	t.assert.equal(CafeMenuIsClosed().days[0]?.date, campusToday())
})

void test('dates a menu that failed to load by the campus calendar', (t) => {
	t.assert.equal(CafeMenuWithError('boom', 'Could not load').days[0]?.date, campusToday())
})
