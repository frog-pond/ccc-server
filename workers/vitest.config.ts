import {cloudflareTest} from '@cloudflare/vitest-plugin'
import {defineConfig} from 'vitest/config'

export default defineConfig({
	plugins: [cloudflareTest({wrangler: {configPath: './wrangler.jsonc'}})],
	test: {
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
