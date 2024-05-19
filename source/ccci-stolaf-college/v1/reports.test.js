import {suite, test} from 'node:test'
import assert from 'node:assert/strict'
import lodash from 'lodash'

import * as reports from './reports.js'
import {StavReportType} from '../../reports-bonapp/types.js'

const {noop} = lodash

const reportFunctions = {
	stav: reports.REPORT_URLS.stav,
}

suite('sanity checks', () => {
	test('all report info endpoints are represented in this test file', () => {
		assert.deepStrictEqual(
			Object.keys(reportFunctions),
			Object.keys(reports.REPORT_URLS),
		)
	})
})

suite('endpoints should not throw', {concurrency: 4}, () => {
	for (const report of Object.keys(reports.REPORT_URLS)) {
		test(`${report} report endpoint should return a StavReportType struct`, async () => {
			let ctx = {cacheControl: noop, body: null}
			await assert.doesNotReject(() => reportFunctions[report](ctx))
			assert.doesNotThrow(() => StavReportType.parse(ctx.body))
		})
	}
})
