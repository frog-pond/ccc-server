import {createRouteSpec} from 'koa-zod-router'
import {getAllOrgs, SortableCarletonStudentOrgSchema} from '../../carleton-edu/student-org.js'

export const getStudentOrgsRoute = createRouteSpec({
	method: 'get',
	path: '/orgs',
	validate: {
		response: SortableCarletonStudentOrgSchema.array(),
	},
	handler: async (ctx) => {
		ctx.body = await getAllOrgs()
	},
})
