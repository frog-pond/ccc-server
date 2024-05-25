import {createRouteSpec} from 'koa-zod-router'
import {getAllJobs, StudentWorkResponseSchema} from '../../carleton-edu/student-work.js'

export const getJobsRoute = createRouteSpec({
	method: 'get',
	path: '/jobs',
	validate: {
		response: StudentWorkResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getAllJobs()
	},
})
