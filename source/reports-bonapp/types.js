import {z} from 'zod'

export const StavReportType = z.array(z.object({
    title: z.string(),
    times: z.array(z.string()),
    data: z.array(z.number()),
}))
