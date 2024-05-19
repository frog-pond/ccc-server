import {suite, test} from 'node:test'
import assert from 'node:assert/strict'

import * as bonAppReport from './index.js'
import {StavReportType} from './types.js'
import {REPORT_URLS} from '../ccci-stolaf-college/v1/reports.js'

suite('report info', {concurrency: true}, () => {
	test('fetching the data should not throw', async () => {
		await assert.doesNotReject(() => bonAppReport.report(REPORT_URLS.stav))
	})

	test('it should return a StavReportType struct', async () => {
		let data = await bonAppReport.report(REPORT_URLS.stav)
		assert.doesNotThrow(() => StavReportType.parse(data))
	})
})
