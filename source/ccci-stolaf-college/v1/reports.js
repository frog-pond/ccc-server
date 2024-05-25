import {ONE_HOUR} from '../../ccc-lib/constants.js'
import * as report from '../../reports-bonapp/index.js'
import mem from 'memoize'

const getReport = mem(report.report, {maxAge: ONE_HOUR})

export const REPORT_URLS = {
	stav: 'https://www.stolaf.edu/apps/mealtimes/',
}

export async function stavMealtimeReport(ctx) {
	ctx.cacheControl(ONE_HOUR)

	ctx.body = await getReport(REPORT_URLS.stav)
}
