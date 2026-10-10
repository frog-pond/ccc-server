import {streamsFrom} from '../../../source/ccci-stolaf-college/v1/streams-shape.ts'
import {registerArchive} from '../archive.ts'
import {STREAMS_URL} from '../sources/streams.ts'
import {upstream} from '../upstream.ts'

/// Streams a backfill step reads.
const PER_PAGE = 100

export type Stream = ReturnType<typeof streamsFrom>['streams'][number]

/// St. Olaf's streams, kept by upstream's event id. The history is read from
/// the whole collection, newest first, a page at a time, until upstream has
/// no more.
export const streamsArchive = registerArchive({
	name: 'streams',
	key: () => 'stolaf',
	id: (stream: Stream) => String(stream.eid),
	at: (stream: Stream) => Date.parse(stream.starttime),
	async backfill(_params: Record<string, never>, _env, cursor) {
		let offset = cursor === null ? 0 : Number(cursor)
		let query = new URLSearchParams({
			class: 'all',
			sort: 'descending',
			count: String(PER_PAGE),
			offset: String(offset),
		})
		let response = await upstream(`${STREAMS_URL}?${query.toString()}`)
		if (!response.ok) {
			throw new Error(`The streams collection responded ${String(response.status)}`)
		}
		let {streams, available} = streamsFrom(await response.json())
		let next = offset + streams.length
		let more = streams.length > 0 && (available === undefined || next < available)
		return {items: streams, next: more ? String(next) : null}
	},
})
