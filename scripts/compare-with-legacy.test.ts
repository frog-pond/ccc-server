import {test} from 'node:test'
import {differences} from './compare-with-legacy.ts'

void test('identical bodies have no differences', (t) => {
	t.assert.deepEqual(differences({a: [1, {b: 2}]}, {a: [1, {b: 2}]}), [])
})

void test('a changed value is reported by its path', (t) => {
	t.assert.deepEqual(differences({a: [1, {b: 2}]}, {a: [1, {b: 3}]}), ['$.a[1].b: 2 → 3'])
})

void test('a missing key is reported', (t) => {
	t.assert.deepEqual(differences({a: 1, b: 2}, {a: 1}), ['$.b: 2 → undefined'])
})

void test('keys on the allowlist are ignored wherever they appear', (t) => {
	t.assert.deepEqual(
		differences({items: [{datePublished: 'x', t: 1}]}, {items: [{datePublished: 'y', t: 1}]}),
		[],
	)
})
