import {getJson} from '../ccc-lib/http.ts'
import {
	livestatsUrlFromScoresUrl,
	scoresFromFeeds,
	withYesterday,
	yesterdayCalendarUrl,
	yesterdaysGames,
	type Score,
} from './shape.ts'

export * from './shape.ts'

export async function fetchAthleticsScores(url: string, teamName: string): Promise<Score[]> {
	const now = new Date()
	const [scoresJson, livestatsJson, calendarJson] = await Promise.all([
		getJson(url),
		// A failed livestats request counts as no live games.
		getJson(livestatsUrlFromScoresUrl(url)).catch(() => null),
		// And a failed calendar request as no games yesterday.
		getJson(yesterdayCalendarUrl(url, now)).catch(() => null),
	])
	const school = {origin: new URL(url).origin, teamName}
	return withYesterday(
		scoresFromFeeds(scoresJson, livestatsJson, now),
		yesterdaysGames(calendarJson, now, school),
	)
}
