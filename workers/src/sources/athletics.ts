import {
	kickoffTime,
	livestatsUrlFromScoresUrl,
	needsFrequentRefresh,
	scoresFromFeeds,
	withYesterday,
	yesterdayCalendarUrl,
	yesterdaysGames,
	type Score,
} from '../../../source/athletics/shape.ts'
import {clock} from '../clock.ts'
import {SOURCE_TTL} from '../lifetimes.ts'
import {defineSource} from '../define-source.ts'
import {registerSource} from '../registry.ts'
import {upstream} from '../upstream.ts'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
/// how long before kickoff a game counts as about to start, as
/// `needsFrequentRefresh` counts it
const BEFORE_KICKOFF = 5 * MINUTE

/// How long a read of the games stays fresh: a minute while a game is under
/// way or about to start, and otherwise until the next game is about to start,
/// at most the usual hour.
export function athleticsFreshFor(scores: Score[], fetchedAt: number): number {
	if (needsFrequentRefresh(scores, new Date(fetchedAt))) return MINUTE
	let until = SOURCE_TTL
	for (let score of scores) {
		let kickoff = kickoffTime(score)?.getTime()
		if (kickoff !== undefined && kickoff > fetchedAt) {
			until = Math.min(until, kickoff - BEFORE_KICKOFF - fetchedAt)
		}
	}
	return Math.max(until, MINUTE)
}

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

/// A feed whose failure only leaves out what it adds: logged, so a site
/// blocking the worker shows, and read as nothing.
const leftOut = (feed: string) => (err: unknown) => {
	console.warn(`athletics: left out ${feed}:`, err instanceof Error ? err.message : String(err))
	return null
}

/// A college's games, as the Node server's `/athletics/scores` makes them
/// (`source/athletics/shape.ts`, shared with it): the scores feed, with the
/// livestats feed's scores for games under way and the calendar's results for
/// yesterday's games. The scores feed failing is an error; the other two
/// failing only leaves out what they add, as on the Node server. Read every
/// minute while a game is under way or about to start, so it is at most a
/// minute behind, and otherwise hourly (`athleticsFreshFor`).
export const athleticsScores = defineSource({
	name: 'athletics-scores',
	key: ({scoresUrl}: AthleticsParams) => scoresUrl,
	async load({scoresUrl, teamName}): Promise<Score[]> {
		let now = new Date(clock.now())
		let [scoresJson, livestatsJson, calendarJson] = await Promise.all([
			readJson(scoresUrl),
			readJson(livestatsUrlFromScoresUrl(scoresUrl)).catch(leftOut('livestats')),
			readJson(yesterdayCalendarUrl(scoresUrl, now)).catch(leftOut('yesterday’s calendar')),
		])
		let school = {origin: new URL(scoresUrl).origin, teamName}
		return withYesterday(
			scoresFromFeeds(scoresJson, livestatsJson, now),
			yesterdaysGames(calendarJson, now, school),
		)
	},
	ttl: SOURCE_TTL,
	ttlFor: athleticsFreshFor,
	staleIfError: DAY,
})
registerSource(athleticsScores)
