import {getJobs, JobSchema} from '../../stolaf-edu/student-work.js'
import {createRouteSpec} from 'koa-zod-router'

export const getJobsRoute = createRouteSpec({
	method: 'get',
	path: '/jobs',
	validate: {
		response: JobSchema.array(),
	},
	handler: async (ctx) => {
		ctx.body = await getJobs()
	},
})
