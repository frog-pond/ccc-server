import {test, type TestContext} from 'node:test'

import {rulesFor} from './mess.ts'
import {ONE_DAY, ONE_HOUR, ONE_MINUTE} from '../../ccc-lib/constants.ts'

const query = (querystring: string) => new URLSearchParams(querystring)

void test('rulesFor', async (t) => {
	await t.test('allows every request the app makes', (t: TestContext) => {
		let requests: [string, string | undefined, string][] = [
			['posts', undefined, 'per_page=50&_embed=true&page=3'],
			['posts', undefined, 'categories=12&per_page=30&_embed=true'],
			['posts', undefined, 'include=1,2,3&per_page=100&_embed=true'],
			['posts', undefined, 'categories=12&staff_name=390&per_page=7&_embed=true'],
			['posts', undefined, 'per_page=100&page=2&_fields=id,date,title,categories,featured_media'],
			['posts', '36238', '_embed=true'],
			['posts', '36238', '_fields=content'],
			['categories', undefined, 'per_page=100&_fields=id,name,parent'],
			['media', undefined, 'include=4,5&per_page=100&_fields=id,source_url,media_details,caption'],
			['staff_profile', undefined, 'staff_name=390&_embed=true'],
			[
				'staff_profile',
				undefined,
				'staff_year=7&per_page=100&_embed=wp:featuredmedia,wp:term&_fields=id,title,content,excerpt,featured_media,_links,_embedded&page=2',
			],
			['staff_year', undefined, 'hide_empty=true&per_page=100&_fields=id,name'],
			['pages', undefined, 'slug=about&_fields=content'],
		]
		for (let [resource, id, querystring] of requests) {
			let verdict = rulesFor(resource, id, query(querystring))
			t.assert.ok('rules' in verdict, `${resource} ${id ?? ''} ?${querystring}`)
		}
	})

	await t.test('caches each resource for its own time', (t: TestContext) => {
		let ttl = (resource: string, id?: string) => {
			let verdict = rulesFor(resource, id, query(''))
			return 'rules' in verdict ? verdict.rules.ttl : undefined
		}
		t.assert.equal(ttl('posts'), 5 * ONE_MINUTE)
		t.assert.equal(ttl('posts', '1'), ONE_HOUR)
		for (let resource of ['categories', 'media', 'staff_profile', 'staff_year', 'pages']) {
			t.assert.equal(ttl(resource), ONE_DAY)
		}
	})

	await t.test('refuses a resource it does not serve with a 404', (t: TestContext) => {
		for (let resource of ['users', 'settings', 'constructor', '__proto__', 'toString', '']) {
			let verdict = rulesFor(resource, undefined, query(''))
			t.assert.ok('refusal' in verdict && verdict.refusal.status === 404, resource)
		}
	})

	await t.test(
		'refuses an id on anything but posts, and an id that is not a number',
		(t: TestContext) => {
			for (let [resource, id] of [
				['categories', '3'],
				['posts', 'abc'],
				['posts', '1.5'],
			] as const) {
				let verdict = rulesFor(resource, id, query(''))
				t.assert.ok('refusal' in verdict && verdict.refusal.status === 404, `${resource}/${id}`)
			}
		},
	)

	await t.test(
		'refuses an unknown, repeated or malformed parameter with a 400',
		(t: TestContext) => {
			for (let querystring of [
				'search=hello',
				'per_page=50&per_page=60',
				'per_page=lots',
				'include=1;2',
				'_embed=yes',
				'_fields=id,<script>',
				'cachebust=1',
			]) {
				let verdict = rulesFor('posts', undefined, query(querystring))
				t.assert.ok('refusal' in verdict && verdict.refusal.status === 400, querystring)
			}
			let slug = rulesFor('pages', undefined, query('slug=../about'))
			t.assert.ok('refusal' in slug && slug.refusal.status === 400)
		},
	)

	await t.test('checks the decoded values of an encoded query string', (t: TestContext) => {
		t.assert.ok('rules' in rulesFor('posts', undefined, query('_fields=id%2Cdate&per_page=2')))
	})
})
