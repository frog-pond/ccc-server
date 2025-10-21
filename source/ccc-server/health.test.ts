import {test} from 'node:test'
import type {TestContext} from 'node:test'
import {health} from './health.ts'
import type {Context} from './context.ts'

void test('health endpoint should return version and status', async (t: TestContext) => {
	// Set APP_VERSION for testing
	const originalVersion = process.env['APP_VERSION']
	process.env['APP_VERSION'] = '1.2.3'

	const ctx = {body: null} as Context
	await health(ctx)

	t.assert.ok(ctx.body !== null, 'Response body should not be null')
	t.assert.equal(typeof ctx.body, 'object', 'Response should be an object')

	const body = ctx.body as {version: string; status: string}
	t.assert.ok(body.version, 'Response should include version')
	t.assert.equal(body.status, 'ok', 'Status should be "ok"')
	t.assert.equal(typeof body.version, 'string', 'Version should be a string')
	t.assert.equal(body.version, '1.2.3', 'Version should match APP_VERSION env var')

	// Restore original env var
	if (originalVersion !== undefined) {
		process.env['APP_VERSION'] = originalVersion
	} else {
		delete process.env['APP_VERSION']
	}
})

void test('health endpoint should fall back to git describe', async (t: TestContext) => {
	// Clear APP_VERSION to test git fallback
	const originalVersion = process.env['APP_VERSION']
	delete process.env['APP_VERSION']

	const ctx = {body: null} as Context
	await health(ctx)

	t.assert.ok(ctx.body !== null, 'Response body should not be null')
	const body = ctx.body as {version: string; status: string}
	t.assert.ok(body.version, 'Response should include version')
	t.assert.equal(body.status, 'ok', 'Status should be "ok"')
	// Version should be a git commit hash or tag (not empty)
	t.assert.ok(body.version.length > 0, 'Version should not be empty')

	// Restore original env var
	if (originalVersion !== undefined) {
		process.env['APP_VERSION'] = originalVersion
	}
})
