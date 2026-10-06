import {test} from 'node:test'
import * as bonApp from './index.ts'
import {captureMetrics, takeMetrics} from '../ccc-lib/metrics-testing.ts'

const seen = captureMetrics()

const STAV = 'https://stolaf.cafebonappetit.com/cafe/stav-hall/'
const FEED = {source: 'bonapp', feed: 'stolaf.cafebonappetit.com/cafe/stav-hall/'}

const ITEM = {
	description: '',
	id: '1',
	label: 'Pancakes',
	nutrition: {},
	rating: '0',
	special: 0,
	station: 'Grill',
	sub_station: '',
	sub_station_id: '0',
	sub_station_order: '0',
	zero_entree: '0',
}

function page(items: Record<string, unknown>) {
	return `<script>
Bamco = (typeof Bamco !== "undefined") ? Bamco : {};
Bamco.current_cafe = {
	name: 'Stav Hall',
	id: 261 };
Bamco.menu_items = ${JSON.stringify(items)};
Bamco.cor_icons = [];
</script>`
}

function serve(t: test.TestContext, html: string) {
	t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(html)))
}

void test('a menu is told with how many items it has', async (t) => {
	serve(t, page({1: {...ITEM, id: '1'}, 2: {...ITEM, id: '2', label: 'Eggs'}}))
	await bonApp.menu(STAV)
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [[2, {...FEED, closed: false}]])
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [])
})

void test('an open café with an empty menu is told as zero items', async (t) => {
	serve(t, page({}))
	await bonApp.menu(STAV)
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [[0, {...FEED, closed: false}]])
})

void test('a closed café is told as zero items, marked closed', async (t) => {
	serve(t, '<html><body>closed</body></html>')
	await bonApp.menu(STAV)
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [[0, {...FEED, closed: true}]])
})

void test('a page that cannot be read is counted as a failure', async (t) => {
	serve(t, '<script>Bamco.current_cafe = {};</script>')
	t.mock.method(console, 'error', () => undefined)
	await bonApp.menu(STAV)
	t.assert.deepEqual(takeMetrics(seen, 'feed.items'), [])
	t.assert.deepEqual(takeMetrics(seen, 'feed.failure'), [[1, FEED]])
})
