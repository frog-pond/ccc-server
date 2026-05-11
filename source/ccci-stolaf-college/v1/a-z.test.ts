import {test} from 'node:test'
import assert from 'node:assert/strict'

import {normalizeAndValidateAzValues} from './a-z.ts'

void test('normalizeAndValidateAzValues should normalize relative urls and drop invalid entries', () => {
	const values = normalizeAndValidateAzValues([
		{label: '', url: ''},
		{label: 'Directory', url: '/directory'},
		{label: 'Missing Url', url: ''},
		{label: 'Bad Url', url: 'not a url'},
		{label: 'Valid Url', url: 'https://example.com/path'},
	])

	assert.deepStrictEqual(values, [
		{label: 'Directory', url: 'https://stolaf.edu/directory'},
		{label: 'Valid Url', url: 'https://example.com/path'},
	])
})
