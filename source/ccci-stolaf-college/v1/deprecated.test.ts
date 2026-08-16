import {test} from 'node:test'
import assert from 'node:assert/strict'

import * as deprecated from './deprecated.ts'
import type {Context} from '../../ccc-server/context.ts'

function fakeContext(): Context & {body: unknown} {
	return {
		body: undefined,
		cacheControl: () => undefined,
		cached: () => false,
	} as unknown as Context & {body: unknown}
}

void test('jobs answers with a single posting rather than an empty list', () => {
	let ctx = fakeContext()
	deprecated.jobs(ctx)

	assert.ok(Array.isArray(ctx.body))
	assert.equal((ctx.body as unknown[]).length, 1)
})

void test('the jobs notice carries every field the shipped screens read', () => {
	let ctx = fakeContext()
	deprecated.jobs(ctx)

	let [job] = ctx.body as Record<string, unknown>[]
	assert.ok(job)

	// The list screen groups by `type` and labels rows with `office`, so a
	// blank either one renders as an unlabelled row under an empty heading.
	assert.equal(typeof job['type'], 'string')
	assert.notEqual(job['type'], '')
	assert.equal(typeof job['office'], 'string')
	assert.notEqual(job['office'], '')

	assert.equal(job['title'], deprecated.UNAVAILABLE_TITLE)
	assert.equal(typeof job['description'], 'string')
	assert.notEqual(job['description'], '')
	assert.equal(typeof job['id'], 'number')
	assert.equal(typeof job['url'], 'string')
	assert.ok(Array.isArray(job['links']))
})

// Older builds parse `lastModified` with moment's `MMMM D, YYYY`; anything
// else renders as "Invalid date" under the posting.
void test('the jobs notice dates itself the way the shipped screens parse', () => {
	let ctx = fakeContext()
	deprecated.jobs(ctx)

	let [job] = ctx.body as Record<string, unknown>[]
	assert.match(String(job?.['lastModified']), /^[A-Z][a-z]+ \d{1,2}, \d{4}$/u)
})

// The repository stopped telling readers to fetch a version that may not
// exist yet; the notice says what cannot be loaded here instead.
void test('the jobs notice does not tell the reader to update', () => {
	let ctx = fakeContext()
	deprecated.jobs(ctx)

	let [job] = ctx.body as Record<string, unknown>[]
	assert.doesNotMatch(String(job?.['description']), /update|app store|newer version/iu)
})
