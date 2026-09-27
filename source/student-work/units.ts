import pMap from 'p-map'

/// Each board posting's unit by posting ID: five digits, or null when its
/// description names none. A posting whose detail could not be read is left
/// out, so a client can read that one itself.
export type PostingUnits = Record<string, string | null>

/// What has been learned of each posting's unit. A posting's unit does not
/// change, so an entry lasts as long as the posting stays on the board.
export type UnitCache = Map<string, string | null>

export interface UnitSources {
	boardIds: () => Promise<string[]>
	unitOf: (id: string) => Promise<string | null>
}

/// Oracle served eight at a time without complaint in manual testing.
const CONCURRENCY = 8

export async function postingUnits(sources: UnitSources, cache: UnitCache): Promise<PostingUnits> {
	let ids = await sources.boardIds()

	let onBoard = new Set(ids)
	for (let id of cache.keys()) {
		if (!onBoard.has(id)) cache.delete(id)
	}

	let unread = ids.filter((id) => !cache.has(id))
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
