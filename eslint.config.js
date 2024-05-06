import js from '@eslint/js'
import globals from 'globals'

import prettier from 'eslint-config-prettier'

export default [
	js.configs.recommended,
	prettier,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {...globals.node},
		},
		rules: {
			'array-callback-return': 'error',
			camelcase: ['warn', {properties: 'never', ignoreDestructuring: true}],
			'consistent-this': ['error', 'self'],
			curly: ['warn', 'multi-line'],
			'default-case': 'error',
			'guard-for-in': 'error',
			eqeqeq: ['error', 'always', {null: 'ignore'}],
			'linebreak-style': ['error', 'unix'],
			'new-cap': 'off',
			'no-await-in-loop': 'warn',
			'no-case-declarations': 'error',
			'no-confusing-arrow': 'off',
			'no-console': 'off',
			'no-div-regex': 'error',
			'no-eq-null': 'warn',
			'no-extra-label': 'error',
			'no-implicit-coercion': [
				'error',
				{boolean: true, number: true, string: true},
			],
			'no-implicit-globals': 'error',
			'no-multi-assign': 'error',
			'no-new-symbol': 'error',
			'no-restricted-syntax': ['error', 'WithStatement'],
			'no-return-await': 'error',
			'no-throw-literal': 'error',
			'no-undef-init': 'off',
			'no-underscore-dangle': 'off',
			'no-unmodified-loop-condition': 'error',
			'no-unused-vars': ['warn', {args: 'after-used', argsIgnorePattern: '^_'}],
			'no-useless-constructor': 'error',
			'no-var': 'error',
			'prefer-promise-reject-errors': 'error',
			'prefer-spread': 'error',
			quotes: ['warn', 'single', 'avoid-escape'],
			'require-await': 'warn',
			semi: 'off',
		},
	},
]
