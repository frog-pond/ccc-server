import {test} from 'node:test'
import type {TestContext} from 'node:test'
import {restart} from './restart.ts'
import type {Context} from './context.ts'

void test('restart endpoint should return success response', async (t: TestContext) => {
	// Mock process.exit to prevent actual exit during test
	const originalExit = process.exit.bind(process)
	let exitCalled = false
	let exitCode: number | undefined

	// @ts-expect-error - Mocking process.exit for testing
	process.exit = (code?: number) => {
		exitCalled = true
		exitCode = code
	}

	const ctx = {
		status: 200,
		body: null,
	} as Context

	restart(ctx)

	t.assert.equal(ctx.status, 200, 'Status should be 200')
	t.assert.ok(ctx.body !== null, 'Response body should not be null')
	const body = ctx.body as {message: string}
	t.assert.equal(body.message, 'Server restart initiated', 'Should return restart message')

	// Wait for setImmediate to execute
	await new Promise((resolve) => setImmediate(resolve))

	// Restore process.exit
	process.exit = originalExit

	// In production, process.exit would be called with code 0
	// We verify it was called correctly
	t.assert.ok(exitCalled, 'process.exit should be called')
	t.assert.equal(exitCode, 0, 'Exit code should be 0')
})
