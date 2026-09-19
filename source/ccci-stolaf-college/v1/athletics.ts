import {fetchAthleticsScores, type Score} from '../../athletics/index.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

const ATHLETICS_URL = 'https://athletics.stolaf.edu/services/scores_chris.aspx?format=json'

const FIVE_MINUTES = ONE_MINUTE * 5

function hasLiveOrUpcomingGame(scores: Score[]): boolean {
	const now = Date.now()
	return scores.some((s) => {
		if (s.status.indicator === 'O') return true
		const startTime = new Date(s.date_utc).getTime()
		return startTime > now && startTime - now < 5 * ONE_MINUTE
	})
}

export async function scores(ctx: Context) {
	ctx.cacheControl(FIVE_MINUTES)
	if (ctx.cached(FIVE_MINUTES)) return

	const data = await fetchAthleticsScores(ATHLETICS_URL)

	if (hasLiveOrUpcomingGame(data)) {
		ctx.setCacheTTL(ONE_MINUTE)
		ctx.cacheControl(ONE_MINUTE)
	}

	ctx.body = data
}
