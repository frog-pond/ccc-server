import {test} from 'node:test'
import {testableRoutes} from './testable-routes.ts'

function walked(...paths: string[]) {
	return testableRoutes(paths.map((path) => ({path})))
}

void test('calendar routes backed by ICS feeds are walked', (t) => {
	t.assert.deepEqual(
		walked(
			'/v1/calendar/named/carleton',
			'/v1/calendar/named/upcoming-convos',
			'/v1/calendar/named/sumo-schedule',
			'/v1/convos/upcoming',
		),
		[
			'/v1/calendar/named/carleton',
			'/v1/calendar/named/upcoming-convos',
			'/v1/calendar/named/sumo-schedule',
			'/v1/convos/upcoming',
		],
	)
})

void test('retired calendar routes, which answer with a notice, are walked', (t) => {
	t.assert.deepEqual(walked('/v1/calendar/named/stolaf', '/v1/calendar/named/the-cave'), [
		'/v1/calendar/named/stolaf',
		'/v1/calendar/named/the-cave',
	])
})

void test('Google Calendar routes are skipped', (t) => {
	t.assert.deepEqual(
		walked(
			'/v1/calendar/named/northfield',
			'/v1/calendar/named/krlx-schedule',
			'/v1/calendar/named/ksto-schedule',
		),
		[],
	)
})

void test('calendar routes that need a query parameter are skipped', (t) => {
	t.assert.deepEqual(walked('/v1/calendar/google', '/v1/calendar/ics'), [])
})

void test('routes with path parameters are skipped', (t) => {
	t.assert.deepEqual(walked('/v1/food/menu/:cafeId'), [])
})
