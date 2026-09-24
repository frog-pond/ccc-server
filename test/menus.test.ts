import {test} from 'node:test'
import {bundleSchool, SCHOOLS, startWorker} from './harness.ts'
import {FIXTURES_DIR, replayUpstream} from './fixtures.ts'
import {CafeInfoResponseSchema, CafeMenuResponseSchema} from '../source/menus-bonapp/types.ts'

const CAFES = [
	'stav-hall',
	'the-cage',
	'kings-room',
	'the-cave',
	'burton',
	'ldc',
	'sayles',
	'weitz',
	'schulze',
]

for (let school of SCHOOLS) {
	void test(`${school}: named café and menu routes match the response schemas`, async (t) => {
		let replay = replayUpstream(FIXTURES_DIR)
		let mf = await startWorker({
			scriptPath: bundleSchool(school),
			bindings: {INSTITUTION: school, GOOGLE_CALENDAR_API_KEY: 'replay'},
			upstream: replay.upstream,
		})
		t.after(() => mf.dispose())

		// one café at a time keeps a failure's message pointing at one café
		for (let cafe of CAFES) {
			// eslint-disable-next-line no-await-in-loop
			let cafeResponse = await mf.dispatchFetch(`http://localhost/v1/food/named/cafe/${cafe}`)
			// eslint-disable-next-line no-await-in-loop
			let info: unknown = await cafeResponse.json()
			t.assert.doesNotThrow(() => CafeInfoResponseSchema.parse(info), `cafe ${cafe}`)

			// eslint-disable-next-line no-await-in-loop
			let menuResponse = await mf.dispatchFetch(`http://localhost/v1/food/named/menu/${cafe}`)
			// eslint-disable-next-line no-await-in-loop
			let menu: unknown = await menuResponse.json()
			t.assert.doesNotThrow(() => CafeMenuResponseSchema.parse(menu), `menu ${cafe}`)
		}
		t.assert.deepEqual(replay.missing, [])
	})
}
