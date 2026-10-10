import {
	streamsFrom,
	type StOlafParamsType,
} from '../../../source/ccci-stolaf-college/v1/streams-shape.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {SOURCE_TTL} from '../lifetimes.ts'
import {upstream} from '../upstream.ts'

const DAY = 24 * 60 * 60 * 1000

/// St. Olaf's streaming collection, the only address this reads.
export const STREAMS_URL = 'https://www.stolaf.edu/multimedia/api/collection'

/// The query, as upstream is asked it: the parameters in a fixed order, so
/// every spelling of one request shares one stored copy.
export function streamsQuery(params: StOlafParamsType): string {
	let query = new URLSearchParams()
	for (let [name, value] of Object.entries(params).toSorted(([a], [b]) => a.localeCompare(b))) {
		if (value !== undefined) query.set(name, String(value))
	}
	return query.toString()
}

/// One page of St. Olaf's streams for one query, as the Node server's
/// `/streams/*` routes make it (`streamsFrom` in
/// `source/ccci-stolaf-college/v1/streams-shape.ts`, shared with it), with how
/// many match in all when upstream says. The routes check the query first.
/// Errors never name the query.
export const streams = defineSource({
	name: 'streams',
	key: (params: StOlafParamsType) => streamsQuery(params),
	async load(params) {
		let response = await upstream(`${STREAMS_URL}?${streamsQuery(params)}`)
		if (!response.ok) {
			throw new Error(`The streams collection responded ${String(response.status)}`)
		}
		return streamsFrom(await response.json())
	},
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(streams)
