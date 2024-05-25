import {createRouteSpec} from 'koa-zod-router'
import {
	DepartmentsResponseSchema,
	getDirectoryDepartments,
	getDirectoryMajors,
	MajorsResponseSchema,
} from '../../stolaf-edu/directory.js'

export const getDepartmentsRoute = createRouteSpec({
	method: 'get',
	path: '/directory/departments',
	validate: {
		response: DepartmentsResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getDirectoryDepartments()
	},
})

export const getMajorsRoute = createRouteSpec({
	method: 'get',
	path: '/directory/majors',
	validate: {
		response: MajorsResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await getDirectoryMajors()
	},
})
