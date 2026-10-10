import {
	CONVOS_CALENDAR_URL,
	CONVOS_PODCAST_URL,
	archivedFrom,
	upcomingFrom,
} from '../../../source/ccci-carleton-college/v1/convos-shape.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {SOURCE_TTL} from '../lifetimes.ts'
import {upstream} from '../upstream.ts'
import {recordItems} from '../archive.ts'
import {convosArchive, type Convo} from '../archives/convos.ts'

const DAY = 24 * 60 * 60 * 1000

/// A convocation's code on the calendar, as its `?eId=` links carry it.
export const CONVO_ID = /^[A-Za-z0-9]{1,32}$/u

async function readText(url: string, what: string, expected: RegExp): Promise<string> {
	// the url is built here from fixed addresses, so a redirect is not followed
	let response = await upstream(url)
	if (!response.ok) throw new Error(`${what} responded ${String(response.status)}`)
	let type = response.headers.get('content-type') ?? ''
	if (!expected.test(type)) throw new Error(`${what} answered ${type || 'nothing'}`)
	return response.text()
}

/// One convocation's images, description and sponsor, from its page on the
/// convocations calendar, as the Node server's `/convos/upcoming/:id` makes
/// them (`upcomingFrom` in `source/ccci-carleton-college/v1/convos-shape.ts`,
/// shared with it). A page without the event is an error.
export const convoDetail = defineSource({
	name: 'convo-detail',
	key: ({id}: {id: string}) => id,
	async load({id}) {
		if (!CONVO_ID.test(id)) throw new Error('not a convocation id')
		let url = `${CONVOS_CALENDAR_URL}?${new URLSearchParams({eId: id}).toString()}`
		return upcomingFrom(await readText(url, 'The convocations calendar', /html/u))
	},
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(convoDetail)

/// The convocations podcast feed. An answer that is not RSS is an error.
export async function readPodcast(): Promise<string> {
	let body = await readText(CONVOS_PODCAST_URL, 'The convocations podcast', /xml/u)
	if (!/<rss[\s>]/u.test(body)) throw new Error('The convocations podcast is not an RSS feed')
	return body
}

/// The latest hundred convocations in the podcast feed, as the Node server's
/// `/convos/archived` makes them (`archivedFrom`). An answer that is not XML is
/// an error, not an empty list.
export const archivedConvos = defineSource({
	name: 'convos-archived',
	key: () => CONVOS_PODCAST_URL,
	async load() {
		// a date in the list is a moment, stored as the JSON it answers with
		return JSON.parse(JSON.stringify(archivedFrom(await readPodcast()))) as Convo[]
	},
	record: (_params, convos, env) => recordItems(env, convosArchive, {}, convos),
	ttl: SOURCE_TTL,
	staleIfError: DAY,
})
registerSource(archivedConvos)
