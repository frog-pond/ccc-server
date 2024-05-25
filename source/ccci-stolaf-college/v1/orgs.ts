import {ONE_HOUR} from '../../ccc-lib/constants.js'
import mem from 'memoize'

import {presence as _presence, StudentOrgResponseSchema} from '../../student-orgs/presence.js'
import {createRouteSpec} from 'koa-zod-router'

const CACHE_DURATION = ONE_HOUR * 36

export const presence = mem(_presence, {maxAge: CACHE_DURATION})

export const getStudentOrgsRoute = createRouteSpec({
	method: 'get',
	path: '/orgs',
	validate: {
		response: StudentOrgResponseSchema,
	},
	handler: async (ctx) => {
		ctx.body = await presence('stolaf')
	},
})
