import js from '@eslint/js'
import globals from 'globals'

import prettier from 'eslint-config-prettier'
import ts from 'typescript-eslint'

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
export default [
	js.configs.recommended,
	...ts.configs.strictTypeChecked,
	...ts.configs.stylisticTypeChecked,
	prettier,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {...globals.node},
			parserOptions: {
				project: true,
				tsconfigRoot: import.meta.dirname,
			},
		},
		rules: {
			'array-callback-return': 'error',
			camelcase: ['warn', {properties: 'never', ignoreDestructuring: true}],
			'consistent-this': ['error', 'self'],
			curly: ['warn', 'multi-line'],
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
			'@typescript-eslint/no-unused-vars': ['warn', {args: 'after-used', argsIgnorePattern: '^_'}],
			'no-useless-constructor': 'error',
			'no-var': 'error',
			'prefer-const': 'off',
			'prefer-promise-reject-errors': 'error',
			'prefer-spread': 'error',
			quotes: ['warn', 'single', 'avoid-escape'],
			'require-await': 'warn',
			semi: 'off',

			// conflicts with the noPropertyAccessFromIndexSignature tsconfig rule
			'@typescript-eslint/dot-notation': [
				'error',
				{allowIndexSignaturePropertyAccess: true},
			],
		},
	},
	{
		files: ['**/*.js'],
		...ts.configs.disableTypeChecked,
	},
]
