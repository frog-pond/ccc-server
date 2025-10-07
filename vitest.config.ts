import {defineConfig} from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		include: ['source/**/*.test.ts'],
		exclude: ['source/**/*.test-d.ts'],
    setupFiles: ['tests/setup.ts'],
	},
})
