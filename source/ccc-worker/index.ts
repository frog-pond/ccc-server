import type {ExecutionContext, Hono} from 'hono'
import {z} from 'zod'
import {v1 as carletonCollege} from '../ccci-carleton-college/index.ts'
import {v1 as stolafCollege} from '../ccci-stolaf-college/index.ts'
import {createApp} from './app.ts'
import type {AppEnv, Env} from './env.ts'

const InstitutionSchema = z.enum(['stolaf-college', 'carleton-college'])

const ROUTERS = {
	'stolaf-college': stolafCollege,
	'carleton-college': carletonCollege,
} as const

/// One app per institution, built on first use. A Worker only ever sees its own
/// INSTITUTION, so in practice this holds one entry.
const apps = new Map<string, Hono<AppEnv>>()

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		let institution = InstitutionSchema.safeParse(env.INSTITUTION)
		if (!institution.success) {
			let message = `the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}, but got: ${env.INSTITUTION}`
			console.error(message)
			return new Response(message, {status: 500})
		}

		let app = apps.get(institution.data)
		if (!app) {
			app = createApp(ROUTERS[institution.data])
			apps.set(institution.data, app)
		}
		return app.fetch(request, env, ctx)
	},
}
