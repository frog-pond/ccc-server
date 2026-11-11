import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {wranglerArgs} from './wrangler-args.ts'

const BASE = ['dev', '-c', 'wrangler.jsonc', '--ip', '::', '--port', '8787']

void describe('wranglerArgs', () => {
	void it('runs the Worker on every address', () => {
		assert.deepStrictEqual(wranglerArgs(8787, {}), BASE)
	})
	void it('passes a dev origin as a var', () => {
		assert.deepStrictEqual(
			wranglerArgs(8787, {PAGES_ORIGIN_OVERRIDE: 'http://editor-mac.local:8790/'}),
			[...BASE, '--var', 'PAGES_ORIGIN_OVERRIDE:http://editor-mac.local:8790/'],
		)
	})
	void it('keeps wrangler state where it is told to', () => {
		assert.deepStrictEqual(wranglerArgs(8787, {CCC_PERSIST_TO: '/tmp/ccc-state'}), [
			...BASE,
			'--persist-to',
			'/tmp/ccc-state',
		])
	})
	void it('ignores empty values', () => {
		assert.deepStrictEqual(
			wranglerArgs(8787, {PAGES_ORIGIN_OVERRIDE: '', CCC_PERSIST_TO: ''}),
			BASE,
		)
	})
})
