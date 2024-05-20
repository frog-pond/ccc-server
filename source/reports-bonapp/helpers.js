import {StavReportType} from './types.js'

/** @returns {StavReportType} */
export function CustomReportType({message}) {
	return StavReportType.parse([
		{
			title: message,
			times: [],
			data: [],
		},
	])
}
