import {test} from 'node:test'

import {BamcoPageContentsSchema} from './types-bonapp.ts'
import {CafeMenuItemSchema} from './types.ts'

/**
 * An item as Bon Appétit's page publishes it. `tier` is the tab the café files
 * it under -- Specials, Additional Favorites, Condiments and Extras -- and
 * arrives as a number for tier 1 but as a string for the others.
 */
function bamcoItem(tier: unknown) {
	return {
		description: '',
		id: '1',
		label: 'beef smash burger',
		nutrition: {kcal: '', well_being: '', well_being_image: ''},
		rating: '',
		special: 0,
		station: '@daily special',
		sub_station: '',
		sub_station_id: '',
		sub_station_order: '',
		tier,
		zero_entree: '0',
	}
}

function tierThroughBothSchemas(tier: unknown) {
	let page = BamcoPageContentsSchema.parse({
		current_cafe: {name: 'The Cage', id: '262'},
		menu_items: {1: bamcoItem(tier)},
		cor_icons: [],
		dayparts: {},
	})
	return CafeMenuItemSchema.parse(page?.menu_items['1']).tier
}

void test('keeps the tier Bon Appétit files an item under', (t) => {
	t.assert.equal(tierThroughBothSchemas(1), 1)
})

void test('reads a tier sent as a string as a number', (t) => {
	t.assert.equal(tierThroughBothSchemas('2'), 2)
	t.assert.equal(tierThroughBothSchemas('3'), 3)
})

void test('accepts an item without a tier', (t) => {
	t.assert.equal(tierThroughBothSchemas(undefined), undefined)
})

void test('a numeric field takes digits, or nothing', (t) => {
	for (const value of ['', '0', '1234']) {
		t.assert.doesNotThrow(() =>
			CafeMenuItemSchema.parse({...bamcoItem(1), sub_station_order: value}),
		)
	}
})

void test('a numeric field refuses anything but digits', (t) => {
	for (const value of ['1-1', 'abc', '12a', ' 1']) {
		t.assert.throws(() => CafeMenuItemSchema.parse({...bamcoItem(1), sub_station_order: value}))
	}
})

/// A BonApp page with one item, `overrides` applied to it.
function pageWith(overrides: Record<string, unknown>) {
	return {
		current_cafe: {name: 'The Cage', id: '262'},
		menu_items: {1: {...bamcoItem(1), ...overrides}},
		cor_icons: [],
		dayparts: {},
	}
}

void test("BonApp's numeric fields take digits, or nothing", (t) => {
	for (const value of ['', '0', '178542']) {
		t.assert.doesNotThrow(() => BamcoPageContentsSchema.parse(pageWith({sub_station_id: value})))
	}
})

void test("BonApp's numeric fields refuse anything but digits", (t) => {
	for (const value of ['1-1', 'abc', '12a', ' 1']) {
		t.assert.throws(() => BamcoPageContentsSchema.parse(pageWith({sub_station_id: value})))
	}
})
