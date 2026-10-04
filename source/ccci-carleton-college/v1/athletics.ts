import {fetchAthleticsScores, needsFrequentRefresh} from '../../athletics/index.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

const ATHLETICS_URL = 'https://athletics.carleton.edu/services/scores_chris.aspx?format=json'

/** What the scores feed calls the school's own team. */
const TEAM_NAME = 'Knights'

const FIVE_MINUTES = ONE_MINUTE * 5

export async function scores(ctx: Context) {
	ctx.cacheControl(FIVE_MINUTES)
	if (ctx.cached(FIVE_MINUTES)) return

	const data = await fetchAthleticsScores(ATHLETICS_URL, TEAM_NAME)

	if (needsFrequentRefresh(data, new Date())) {
		ctx.setCacheTTL(ONE_MINUTE)
		ctx.cacheControl(ONE_MINUTE)
	}

	ctx.body = data
}
