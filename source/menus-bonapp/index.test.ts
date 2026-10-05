import {test} from 'node:test'
import {noop} from 'lodash-es'

import * as bonApp from './index.ts'
import {campusToday} from './helpers.ts'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from './types.ts'

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'

void test('fetching cafe info should not throw', {timeout: 15_000}, async (t) => {
	await t.assert.doesNotReject(bonApp._cafe(STAV))
})

void test(
	'fetching cafe info should return a CafeInfoResponseSchema struct',
	{timeout: 15_000},
	async (t) => {
		const data = await bonApp._cafe(STAV)
		t.assert.doesNotThrow(() => CafeInfoResponseSchema.parse(data))
	},
)

void test('fetching menu info should not throw', {timeout: 15_000}, async (t) => {
	await t.assert.doesNotReject(bonApp._menu(STAV))
})

void test(
	'fetching menu info should return a CafeMenuResponseSchema struct',
	{timeout: 15_000},
	async (t) => {
		const data = await bonApp._menu(STAV)
		t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(data))
	},
)

// The dayparts are the ones BonApp's page shows for today, which is today on
// campus -- including in the evening, when UTC has already moved on.
void test('cafe info is dated by the campus calendar', {timeout: 15_000}, async (t) => {
	const data = await bonApp._cafe(STAV)
	t.assert.equal(data.cafe.days[0]?.date, campusToday())
})

void test('menu info is dated by the campus calendar', {timeout: 15_000}, async (t) => {
	const data = await bonApp._menu(STAV)
	t.assert.equal(data.days[0]?.date, campusToday())
})

/// A BonApp page, as data: URL, with its `Bamco` assignments written the way
/// BonApp writes them, so these need no network.
function bamcoPage(bamco: {
	current_cafe: {name: string; id: number}
	cor_icons?: unknown
	menu_items?: unknown
	dayparts?: Record<string, unknown>
}) {
	let lines = [
		'<script>',
		'Bamco = (typeof Bamco !== "undefined") ? Bamco : {};',
		`Bamco.current_cafe = {\n\tname: '${bamco.current_cafe.name}',\n\tid: ${String(bamco.current_cafe.id)}};`,
	]
	if (bamco.menu_items) lines.push(`Bamco.menu_items = ${JSON.stringify(bamco.menu_items)};`)
	if (bamco.cor_icons) lines.push(`Bamco.cor_icons = ${JSON.stringify(bamco.cor_icons)};`)
	for (let [id, daypart] of Object.entries(bamco.dayparts ?? {})) {
		lines.push('Bamco.dayparts = Bamco.dayparts || {};')
		lines.push(`Bamco.dayparts['${id}'] = ${JSON.stringify(daypart)};`)
	}
	lines.push('</script>')
	return `data:text/html,${encodeURIComponent(lines.join('\n'))}`
}

// A page whose Bamco data no longer matches the schema, as when BonApp
// reshapes its pages.
const BROKEN_PAGE = bamcoPage({current_cafe: {name: 'Stav Hall', id: 261}})

void test('cafe falls back to a placeholder when BonApp cannot be read', async (t) => {
	t.mock.method(console, 'error', noop)
	const data = await bonApp.cafe(BROKEN_PAGE)
	t.assert.equal(data.cafe.message, 'Could not load café from BonApp')
})

void test('menu falls back to an error menu when BonApp cannot be read', async (t) => {
	t.mock.method(console, 'error', noop)
	const data = await bonApp.menu(BROKEN_PAGE)
	t.assert.equal(data.days[0]?.cafe.dayparts[0]?.[0]?.label, 'Errored')
})

/// A BonApp page with one station and one item, as BonApp writes them.
const BAMCO_PAGE = bamcoPage({
	current_cafe: {name: 'Stav Hall', id: 261},
	cor_icons: [],
	menu_items: {
		42: {
			id: '42',
			label: 'mac  &amp; cheese (v)',
			description: '<p>baked <b>golden</b></p><br>with breadcrumbs',
			station: '<strong>@home &amp; hearth</strong>',
			sub_station: 'entrees',
			sub_station_id: '1',
			sub_station_order: '1',
			rating: '0',
			special: 1,
			zero_entree: '0',
		},
	},
	dayparts: {
		1: {
			id: '1',
			label: 'Lunch',
			abbreviation: 'L',
			starttime: '11:00',
			endtime: '13:30',
			starttime_formatted: '11:00 am',
			endtime_formatted: '1:30 pm',
			time_formatted: '11:00 am - 1:30 pm',
			message: '',
			stations: [
				{
					order_id: '1',
					id: '1',
					label: 'home &amp; hearth',
					price: '',
					note: '',
					soup: 0,
					items: ['42'],
				},
			],
		},
	},
})

void test('a menu comes back with its text cleaned', async (t) => {
	let menu = await bonApp._menu(BAMCO_PAGE)
	let item = menu.items['42']

	t.assert.equal(item?.station, 'Home & Hearth')
	t.assert.equal(item?.label, 'Mac & Cheese')
	t.assert.equal(item?.description, 'baked golden with breadcrumbs')
	t.assert.equal(item?.sub_station, 'Entrees')
})

void test("a menu's items still match their stations' labels", async (t) => {
	let menu = await bonApp._menu(BAMCO_PAGE)
	let labels = menu.days[0]?.cafe.dayparts
		.flat()
		.flatMap((part) => part.stations.map((s) => s.label))

	t.assert.deepEqual(labels, ['Home & Hearth'])
	t.assert.equal(labels?.includes(menu.items['42']?.station ?? ''), true)
})
