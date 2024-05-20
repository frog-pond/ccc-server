import test from 'ava'

import * as bonAppReport from './index.js'
import {StavReportSchema} from './types.js'
import {REPORT_URLS} from '../ccci-stolaf-college/v1/reports.js'

test('fetching the data should not throw', async (t) => {
	await t.notThrowsAsync(() => bonAppReport.report(REPORT_URLS.stav))
})

test('it should return a StavReportSchema struct', async (t) => {
	let data = await bonAppReport.report(REPORT_URLS.stav)
	t.notThrows(() => StavReportSchema.parse(data))
})
