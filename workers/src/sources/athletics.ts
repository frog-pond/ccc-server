import {
	livestatsUrlFromScoresUrl,
	scoresFromFeeds,
	withYesterday,
	yesterdayCalendarUrl,
	yesterdaysGames,
	type Score,
} from '../../../source/athletics/shape.ts'
import {clock} from '../clock.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {upstream} from '../upstream.ts'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

/// Only the colleges' athletics sites: the url comes from this worker's own
/// route table.
const ATHLETICS_HOSTS = new Set(['athletics.stolaf.edu', 'athletics.carleton.edu'])

export type AthleticsParams = {
	/// the site's scores feed
	scoresUrl: string
	/// what the feed calls the school's own team
	teamName: string
}

/// One of the site's JSON answers. Errors name the address without its query.
async function readJson(url: string): Promise<unknown> {
	let parsed = new URL(url)
	if (parsed.protocol !== 'https:' || !ATHLETICS_HOSTS.has(parsed.hostname)) {
		throw new Error(`${parsed.origin}${parsed.pathname} is not an athletics feed this reads`)
	}
	// the host was checked above, so a redirect to another is not followed
	let response = await upstream(url)
	if (!response.ok) {
		throw new Error(
			`The athletics site responded ${String(response.status)} for ${parsed.origin}${parsed.pathname}`,
		)
	}
	return response.json()
}

/// A college's games, as the Node server's `/athletics/scores` makes them
/// (`source/athletics/shape.ts`, shared with it): the scores feed, with the
/// livestats feed's scores for games under way and the calendar's results for
/// yesterday's games. The scores feed failing is an error; the other two
/// failing only leaves out what they add, as on the Node server. Read every
/// minute, so a game under way is at most a minute behind, as the Node server
/// keeps it while a game is in play.
export const athleticsScores = defineSource({
	name: 'athletics-scores',
	key: ({scoresUrl}: AthleticsParams) => scoresUrl,
	async load({scoresUrl, teamName}): Promise<Score[]> {
		let now = new Date(clock.now())
		let [scoresJson, livestatsJson, calendarJson] = await Promise.all([
			readJson(scoresUrl),
			readJson(livestatsUrlFromScoresUrl(scoresUrl)).catch(() => null),
			readJson(yesterdayCalendarUrl(scoresUrl, now)).catch(() => null),
		])
		let school = {origin: new URL(scoresUrl).origin, teamName}
		return withYesterday(
			scoresFromFeeds(scoresJson, livestatsJson, now),
			yesterdaysGames(calendarJson, now, school),
		)
	},
	ttl: MINUTE,
	staleIfError: DAY,
})
registerSource(athleticsScores)
