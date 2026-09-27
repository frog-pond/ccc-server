import {test} from 'node:test'
import {postingUnits, type UnitCache} from './units.ts'

function sources(board: string[], units: Record<string, string | null | Error>) {
	let reads: string[] = []
	return {
		reads,
		boardIds: () => Promise.resolve(board),
		unitOf: (id: string) => {
			reads.push(id)
			let unit = units[id]
			if (unit instanceof Error) return Promise.reject(unit)
			return Promise.resolve(unit ?? null)
		},
	}
}

void test('maps every board posting to its unit', async (t) => {
	let result = await postingUnits(sources(['1', '2'], {'1': '11725', '2': null}), new Map())

	t.assert.deepEqual(result, {'1': '11725', '2': null})
})

void test('reads only postings it has not read before', async (t) => {
	let cache: UnitCache = new Map([['1', '11725']])
	let s = sources(['1', '2'], {'2': '22005'})

	let result = await postingUnits(s, cache)

	t.assert.deepEqual(s.reads, ['2'])
	t.assert.deepEqual(result, {'1': '11725', '2': '22005'})
})

/// A posting with no unit is an answer, not a failure, so it is not re-read.
void test('keeps a null unit and does not re-read it', async (t) => {
	let cache: UnitCache = new Map()
	await postingUnits(sources(['1'], {'1': null}), cache)
	let s = sources(['1'], {'1': '11725'})

	let result = await postingUnits(s, cache)

	t.assert.deepEqual(s.reads, [])
	t.assert.deepEqual(result, {'1': null})
})

void test('leaves out a posting whose detail failed, and retries it next time', async (t) => {
	let cache: UnitCache = new Map()
	let first = await postingUnits(sources(['1', '2'], {'1': '11725', '2': new Error('503')}), cache)
	t.assert.deepEqual(first, {'1': '11725'})

	let s = sources(['1', '2'], {'2': '22005'})
	let second = await postingUnits(s, cache)

	t.assert.deepEqual(s.reads, ['2'])
	t.assert.deepEqual(second, {'1': '11725', '2': '22005'})
})

void test('forgets postings that left the board', async (t) => {
	let cache: UnitCache = new Map([
		['1', '11725'],
		['gone', '22005'],
	])

	let result = await postingUnits(sources(['1'], {}), cache)

	t.assert.deepEqual(result, {'1': '11725'})
	t.assert.equal(cache.has('gone'), false)
})

void test('re-reads a posting that left the board and came back', async (t) => {
	let cache: UnitCache = new Map([['1', '11725']])
	await postingUnits(sources([], {}), cache)
	let s = sources(['1'], {'1': '11725'})

	await postingUnits(s, cache)

	t.assert.deepEqual(s.reads, ['1'])
})

void test('fails when the board itself cannot be read', async (t) => {
	let s = {
		boardIds: () => Promise.reject(new Error('board down')),
		unitOf: () => Promise.resolve(null),
	}

	await t.assert.rejects(postingUnits(s, new Map()), /board down/u)
})
