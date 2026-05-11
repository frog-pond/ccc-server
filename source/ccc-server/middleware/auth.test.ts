import {test} from 'node:test'
import type {TestContext} from 'node:test'
import {verifyRestartToken} from './auth.ts'
import type {Context} from '../context.ts'

void test('auth middleware should accept valid token', async (t: TestContext) => {
	const validToken = 'test-secret-token'
	process.env['RESTART_TOKEN'] = validToken

	const ctx = {
		request: {
			headers: {
				authorization: `Bearer ${validToken}`,
			},
		},
		status: 200,
		body: null,
	} as unknown as Context

	let nextCalled = false
	const next = () => {
		nextCalled = true
		return Promise.resolve()
	}

	await verifyRestartToken(ctx, next)
	t.assert.ok(nextCalled, 'next() should be called for valid token')
	t.assert.equal(ctx.status, 200, 'Status should remain 200 for valid token')
})

void test('auth middleware should reject missing token', async (t: TestContext) => {
	process.env['RESTART_TOKEN'] = 'test-secret-token'

	const ctx = {
		request: {
			headers: {},
		},
		status: 200,
		body: null,
	} as unknown as Context

	let nextCalled = false
	const next = () => {
		nextCalled = true
		return Promise.resolve()
	}

	await verifyRestartToken(ctx, next)
	t.assert.equal(ctx.status, 401, 'Status should be 401 for missing token')
	t.assert.ok(!nextCalled, 'next() should not be called for missing token')
})

void test('auth middleware should reject invalid token', async (t: TestContext) => {
	process.env['RESTART_TOKEN'] = 'correct-token'

	const ctx = {
		request: {
			headers: {
				authorization: 'Bearer wrong-token',
			},
		},
		status: 200,
		body: null,
	} as unknown as Context

	let nextCalled = false
	const next = () => {
		nextCalled = true
		return Promise.resolve()
	}

	await verifyRestartToken(ctx, next)
	t.assert.equal(ctx.status, 401, 'Status should be 401 for invalid token')
	t.assert.ok(!nextCalled, 'next() should not be called for invalid token')
})

void test('auth middleware should reject malformed authorization header', async (t: TestContext) => {
	process.env['RESTART_TOKEN'] = 'test-token'

	const ctx = {
		request: {
			headers: {
				authorization: 'NotBearer test-token',
			},
		},
		status: 200,
		body: null,
	} as unknown as Context

	let nextCalled = false
	const next = () => {
		nextCalled = true
		return Promise.resolve()
	}

	await verifyRestartToken(ctx, next)
	t.assert.equal(ctx.status, 401, 'Status should be 401 for malformed header')
	t.assert.ok(!nextCalled, 'next() should not be called for malformed header')
})
