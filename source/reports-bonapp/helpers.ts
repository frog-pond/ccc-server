import {StavReportSchema, type StavReportType} from './types.js'

export function CustomReportType(message: string): StavReportType {
	return StavReportSchema.parse([
		{
			title: message,
			times: [],
			data: [],
		},
	])
}
