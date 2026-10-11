import {streamsFrom} from '../../../source/ccci-stolaf-college/v1/streams-shape.ts'
import {fromJson, registerArchive, toJson} from '../archive.ts'
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
	columns: {
		// upstream's own id, as JSON, since it is not known to be text
		eid: 'TEXT NOT NULL',
		starttime: 'TEXT NOT NULL',
		title: 'TEXT NOT NULL',
		hptitle: 'TEXT NOT NULL',
		subtitle: 'TEXT NOT NULL',
		performer: 'TEXT NOT NULL',
		location: 'TEXT NOT NULL',
		status: 'TEXT NOT NULL',
		category: 'TEXT NOT NULL',
		category_color: 'TEXT NOT NULL',
		category_textcolor: 'TEXT NOT NULL',
		poster: 'TEXT NOT NULL',
		thumb: 'TEXT NOT NULL',
		player: 'TEXT NOT NULL',
		iframesrc: 'TEXT NOT NULL',
	},
	toRow: (stream: Stream) => ({
		eid: toJson(stream.eid),
		starttime: stream.starttime,
		title: stream.title,
		hptitle: stream.hptitle,
		subtitle: stream.subtitle,
		performer: stream.performer,
		location: stream.location,
		status: stream.status,
		category: stream.category,
		category_color: stream.category_color,
		category_textcolor: stream.category_textcolor,
		poster: stream.poster,
		thumb: stream.thumb,
		player: stream.player,
		iframesrc: stream.iframesrc,
	}),
	fromRow: (row): Stream => ({
		starttime: row['starttime'] as string,
		location: row['location'] as string,
		eid: fromJson(row['eid']!),
		performer: row['performer'] as string,
		subtitle: row['subtitle'] as string,
		poster: row['poster'] as string,
		player: row['player'] as string,
		status: row['status'] as string,
		category: row['category'] as string,
		hptitle: row['hptitle'] as string,
		category_textcolor: row['category_textcolor'] as string,
		category_color: row['category_color'] as string,
		thumb: row['thumb'] as string,
		title: row['title'] as string,
		iframesrc: row['iframesrc'] as string,
	}),
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
