import assert from 'node:assert/strict'
import {test} from 'node:test'
import {api} from './index.ts'

/// The routes the app is pointed at; each must exist, or the app's
/// request for it 404s.
const ROUTES = [
	'/v1/a-to-z/extras',
	'/v1/orgs/category-styles',
	'/v1/map/categories',
	'/v1/student-work/areas',
	'/v1/student-work/wages',
	'/v1/map/style',
	'/v1/map/style-dark',
	'/v1/courses/catalog.db',
]

for (const route of ROUTES) {
	void test(`${route} is registered`, () => {
		assert.ok(api.match(route, 'GET').route)
	})
}
