import {test} from 'node:test'
import {advertsFor, campusesFrom} from './discovery.ts'

void test('each campus gets its own advert, pointing at its /v1/ routes', (t) => {
	t.assert.deepEqual(advertsFor(['edu.stolaf', 'edu.carleton'], 'Gecko', 8787), [
		{
			name: 'ccc-server edu.stolaf (Gecko)',
			port: 8787,
			txt: {campus: 'edu.stolaf', path: '/edu.stolaf/v1/'},
		},
		{
			name: 'ccc-server edu.carleton (Gecko)',
			port: 8787,
			txt: {campus: 'edu.carleton', path: '/edu.carleton/v1/'},
		},
	])
})

void test('no campuses means nothing to advertise', (t) => {
	t.assert.deepEqual(advertsFor([], 'Gecko', 8787), [])
})

void test("the campus list comes from the Worker's / answer", (t) => {
	t.assert.deepEqual(campusesFrom({campuses: ['edu.stolaf', 'edu.carleton']}), [
		'edu.stolaf',
		'edu.carleton',
	])
})

void test('an answer without a list of campus names is refused', (t) => {
	for (let body of [null, {}, {campuses: 'edu.stolaf'}, {campuses: [1]}, 'Not Found']) {
		t.assert.throws(() => campusesFrom(body), /did not list its campuses/)
	}
})
