import pMap from 'p-map'

/// Each board posting's unit by posting ID: five digits, or null when its
/// description names none. A posting whose detail could not be read is left
/// out, so a client can read that one itself.
export type PostingUnits = Record<string, string | null>

/// What has been learned of each posting's unit. A unit, once read, lasts as
/// long as its posting stays on the board.
export type UnitCache = Map<string, string | null>

export interface UnitSources {
	boardIds: () => Promise<string[]>
	unitOf: (id: string) => Promise<string | null>
}

/// Oracle served eight at a time without complaint in manual testing.
const CONCURRENCY = 8

/// The run in progress for each cache, which requests arriving together share.
const running = new WeakMap<UnitCache, Promise<PostingUnits>>()

export function postingUnits(sources: UnitSources, cache: UnitCache): Promise<PostingUnits> {
	let run = running.get(cache)
	if (!run) {
		run = readUnits(sources, cache).finally(() => running.delete(cache))
		running.set(cache, run)
	}
	return run
}

async function readUnits(sources: UnitSources, cache: UnitCache): Promise<PostingUnits> {
	let ids = await sources.boardIds()

	let onBoard = new Set(ids)
	for (let id of cache.keys()) {
		if (!onBoard.has(id)) cache.delete(id)
	}

	// A null unit is read again each run: it is usually a typo or a blank that
	// an editor may yet correct.
	let unread = ids.filter((id) => typeof cache.get(id) !== 'string')
	await pMap(
		unread,
		async (id) => {
			try {
				cache.set(id, await sources.unitOf(id))
			} catch {
				// Left out of this answer, and read again on the next request.
			}
		},
		{concurrency: CONCURRENCY},
	)

	let units: PostingUnits = {}
	for (let id of ids) {
		let unit = cache.get(id)
		if (unit !== undefined) units[id] = unit
	}
	return units
}

/// Whether most of the board's postings came back with no unit. A normal
/// board has a handful; most at once means the description template changed
/// under the parser, and every area would read empty.
export function mostlyNull(units: PostingUnits): boolean {
	let values = Object.values(units)
	let nulls = values.filter((unit) => unit === null).length
	return nulls > values.length / 2
}
