import {test} from 'node:test'
import {mostlyUnknown, postingUnits, UNKNOWN_UNIT, type UnitCache} from './units.ts'

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
	let result = await postingUnits(sources(['1', '2'], {'1': '11725', '2': '22005'}), new Map())

	t.assert.deepEqual(result, {'1': '11725', '2': '22005'})
})

void test('reads a posting with no unit as unknown', async (t) => {
	let result = await postingUnits(sources(['1', '2'], {'1': '11725', '2': null}), new Map())

	t.assert.deepEqual(result, {'1': '11725', '2': UNKNOWN_UNIT})
})

void test('reads only postings it has not read before', async (t) => {
	let cache: UnitCache = new Map([['1', '11725']])
	let s = sources(['1', '2'], {'2': '22005'})

	let result = await postingUnits(s, cache)

	t.assert.deepEqual(s.reads, ['2'])
	t.assert.deepEqual(result, {'1': '11725', '2': '22005'})
})

/// A null unit is usually a typo or a blank an editor may yet correct, so it
/// is read again rather than kept for the posting's whole life.
void test('re-reads a null unit on the next request', async (t) => {
	let cache: UnitCache = new Map()
	await postingUnits(sources(['1'], {'1': null}), cache)
	let s = sources(['1'], {'1': '11725'})

	let result = await postingUnits(s, cache)

	t.assert.deepEqual(s.reads, ['1'])
	t.assert.deepEqual(result, {'1': '11725'})
})

/// On a fresh deploy, every request in the cold window would otherwise read
/// every posting's detail from Oracle.
void test('requests that arrive together share one read of each posting', async (t) => {
	let cache: UnitCache = new Map()
	let s = sources(['1', '2'], {'1': '11725', '2': '22005'})

	let [first, second] = await Promise.all([postingUnits(s, cache), postingUnits(s, cache)])

	t.assert.deepEqual(s.reads.toSorted(), ['1', '2'])
	t.assert.deepEqual(first, second)
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

/// Most postings losing their unit at once means the description template
/// changed under the parser, not that most postings lack one.
void test('mostlyUnknown flags a map where most units are unknown', (t) => {
	t.assert.equal(mostlyUnknown({'1': UNKNOWN_UNIT, '2': UNKNOWN_UNIT, '3': '11725'}), true)
})

void test('mostlyUnknown passes the few unknowns a normal board has', (t) => {
	t.assert.equal(mostlyUnknown({'1': UNKNOWN_UNIT, '2': '22005', '3': '11725'}), false)
})

void test('mostlyUnknown passes an empty board', (t) => {
	t.assert.equal(mostlyUnknown({}), false)
})
