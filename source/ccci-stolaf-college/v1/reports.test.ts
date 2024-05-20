import test from 'ava'

import * as reports from './reports.js'
import {StavReportSchema} from '../../reports-bonapp/types.js'
import type {Context} from '../../ccc-server/context.js'
import {noop} from 'lodash-es'
import {keysOf} from '../../ccc-lib/keysOf.js'

const reportFunctions: Record<keyof typeof reports.REPORT_URLS, (c: Context) => Promise<unknown>> =
	{
		stav: reports.stavMealtimeReport,
	}

test('all report info endpoints are represented in this test file', (t) => {
	t.deepEqual(Object.keys(reportFunctions), Object.keys(reports.REPORT_URLS))
})

for (const report of keysOf(reports.REPORT_URLS)) {
	test(`${report} report endpoint should return a StavReportType struct`, async (t) => {
		let ctx = {cacheControl: noop, body: null} as Context
		await t.notThrowsAsync(() => reportFunctions[report](ctx))
		t.notThrows(() => StavReportSchema.parse(ctx.body))
	})
}
