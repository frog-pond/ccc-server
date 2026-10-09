import assert from 'node:assert/strict'
import {test} from 'node:test'
import {z} from 'zod'
import {examples, fromSchema, listInputs, oneOf} from './route-inputs.ts'

void test('oneOf labels each key of a lookup table with its string entry', () => {
	assert.deepEqual(oneOf({261: 'stav', 262: 'cage'}), {
		values: [
			{value: '261', label: 'stav'},
			{value: '262', label: 'cage'},
		],
	})
})

void test('oneOf leaves a value unlabelled when its entry is not a string', () => {
	assert.deepEqual(oneOf({posts: {list: {}}}), {values: [{value: 'posts'}]})
})

void test('oneOf lists the members of a set without labels', () => {
	assert.deepEqual(oneOf(new Set(['spaces', 'webcams'])), {
		values: [{value: 'spaces'}, {value: 'webcams'}],
	})
})

void test('examples gives a free-form input its known-good values', () => {
	assert.deepEqual(examples('a', 'b'), {examples: ['a', 'b']})
})

void test('fromSchema reads query inputs from a zod object as a client would send them', () => {
	const schema = z
		.object({
			query: z.string().trim().min(1),
			sort: z.enum(['ascending', 'descending']).optional(),
			class: z.enum(['archived', 'upcoming']).default('archived'),
			dateFrom: z.iso.date().optional(),
			count: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int()).default(50),
		})
		.refine(() => true)
	assert.deepEqual(fromSchema(schema), {
		query: {in: 'query', required: true},
		sort: {in: 'query', required: false, values: [{value: 'ascending'}, {value: 'descending'}]},
		class: {
			in: 'query',
			required: false,
			values: [{value: 'archived'}, {value: 'upcoming'}],
			examples: ['archived'],
		},
		dateFrom: {in: 'query', required: false, format: 'date'},
		count: {in: 'query', required: false},
	})
})

void test('fromSchema marks whole-number inputs as integers, whether zod or a meta says so', () => {
	const schema = z.object({
		count: z
			.string()
			.regex(/^\d+$/)
			.transform(Number)
			.pipe(z.number().int())
			.meta({format: 'integer'})
			.optional(),
		page: z.number().int().optional(),
	})
	assert.deepEqual(fromSchema(schema), {
		count: {in: 'query', required: false, format: 'integer'},
		page: {in: 'query', required: false, format: 'integer'},
	})
})

void test('listInputs makes every path param a required input, declared or not', () => {
	assert.deepEqual(listInputs(['itemId']), [{name: 'itemId', in: 'path', required: true}])
})

void test('listInputs merges a declaration onto its path param', () => {
	assert.deepEqual(listInputs(['cafeId'], {cafeId: {values: [{value: '262', label: 'cage'}]}}), [
		{name: 'cafeId', in: 'path', required: true, values: [{value: '262', label: 'cage'}]},
	])
})

void test('listInputs lists declared names outside the path as query inputs, optional unless said', () => {
	assert.deepEqual(listInputs([], {id: {...examples('x'), required: true}, key: {}}), [
		{name: 'id', in: 'query', required: true, examples: ['x']},
		{name: 'key', in: 'query', required: false},
	])
})

void test('listInputs keeps an input declared as a field of the request body', () => {
	assert.deepEqual(listInputs([], {text: {...examples('<b>hi</b>'), in: 'body', required: true}}), [
		{name: 'text', in: 'body', required: true, examples: ['<b>hi</b>']},
	])
})
