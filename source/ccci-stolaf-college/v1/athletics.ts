import {fetchAthleticsScores} from '../../athletics/index.ts'
import {ONE_MINUTE} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

const ATHLETICS_URL =
	'https://athletics.stolaf.edu/services/scores_chris.aspx?format=json'

const FIVE_MINUTES = ONE_MINUTE * 5

export async function scores(ctx: Context) {
	ctx.cacheControl(FIVE_MINUTES)
	if (ctx.cached(FIVE_MINUTES)) return

	ctx.body = await fetchAthleticsScores(ATHLETICS_URL)
}
