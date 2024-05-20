import {z} from 'zod'

export type StavReportInstanceType = z.infer<typeof StavReportInstanceSchema>
export const StavReportInstanceSchema = z.object({
	title: z.string(),
	times: z.array(z.string()),
	data: z.array(z.number()),
})

export type StavReportType = z.infer<typeof StavReportSchema>
export const StavReportSchema = z.array(StavReportInstanceSchema)

export type ChartJsInstanceType = z.infer<typeof ChartJsInstance>
export const ChartJsInstance = z.object({
	data: z.object({
		labels: z.string().array().nonempty(),
		datasets: z
			.array(
				z.object({
					label: z.string(),
					data: z.number().array(),
				}),
			)
			.nonempty(),
	}),
})
