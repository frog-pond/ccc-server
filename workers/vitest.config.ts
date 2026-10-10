import {fileURLToPath} from 'node:url'
import {cloudflareTest} from '@cloudflare/vitest-plugin'
import {defineConfig} from 'vitest/config'

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: {configPath: '../wrangler.jsonc'},
			// a secret of the deployed worker; the Google calendar tests check it is sent
			miniflare: {bindings: {GOOGLE_CALENDAR_API_KEY: 'test-calendar-key'}},
		}),
	],
	// moment-timezone is a CommonJS package that requires moment; workerd runs
	// the modules vite bundles, not the ones node would load
	// moment-timezone requires moment, and the resolver reaches moment's ES module
	// build (its "jsnext:main") for that, which a require cannot load
	resolve: {alias: {moment: fileURLToPath(import.meta.resolve('moment'))}},
	test: {
		// the first request of a file loads the worker, whose calendar readers bring
		// in moment-timezone and its zone data, which takes seconds to load here
		testTimeout: 30_000,
		includeTaskLocation: true,
		reporters: [
			'default',
			[
				'@flakiness/vitest',
				{
					// the same project the Node server's tests report to; in GitHub Actions
					// it authenticates with OIDC, and only CI uploads
					flakinessProject: process.env['FLAKINESS_PROJECT'],
					disableUpload: process.env['GITHUB_ACTIONS'] !== 'true',
				},
			],
		],
	},
})
