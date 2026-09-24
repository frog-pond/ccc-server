import {fetchAthleticsScores, type Score} from '../../athletics/index.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import {publicMaxAge} from '../../ccc-worker/cache.ts'
import type {Context} from '../../ccc-worker/env.ts'

const ATHLETICS_URL = 'https://athletics.carleton.edu/services/scores_chris.aspx?format=json'

function hasLiveOrUpcomingGame(scores: Score[]): boolean {
	const now = Date.now()
	return scores.some((s) => {
		if (s.status.indicator === 'O') return true
		const startTime = new Date(s.date_utc).getTime()
		return startTime > now && startTime - now < 5 * ONE_MINUTE
	})
}

/// Cached for five minutes (see the route table), or one minute while a game
/// is on or about to start.
export async function scores(c: Context) {
	const data = await fetchAthleticsScores(ATHLETICS_URL)

	if (hasLiveOrUpcomingGame(data)) {
		c.header('Cache-Control', publicMaxAge(ONE_MINUTE))
	}

	return c.json(data)
}
