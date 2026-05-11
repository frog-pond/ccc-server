import {test} from 'node:test'
import type {TestContext} from 'node:test'
import {health} from './health.ts'
import type {Context} from './context.ts'

void test('health endpoint should return version and status', async (t: TestContext) => {
	const ctx = {body: null} as Context
	await health(ctx)

	t.assert.ok(ctx.body !== null, 'Response body should not be null')
	t.assert.equal(typeof ctx.body, 'object', 'Response should be an object')

	const body = ctx.body as {version: string; status: string}
	t.assert.ok(body.version, 'Response should include version')
	t.assert.equal(body.status, 'ok', 'Status should be "ok"')
	t.assert.equal(typeof body.version, 'string', 'Version should be a string')
	t.assert.match(body.version, /^\d+\.\d+\.\d+/, 'Version should match semver pattern')
})
