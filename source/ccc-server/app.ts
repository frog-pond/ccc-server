import etag from '@koa/etag'
import compress from 'koa-compress'
import {withBodyParsers} from '@koa/body-parsers'
import Router from '@koa/router'
import Koa from 'koa'
import {z} from 'zod'
import type {ContextState, RouterState} from './context.ts'
import {accessLog} from '../ccc-koa/access-log.ts'
import {BEHIND_NGINX} from '../ccc-koa/behind-proxy.ts'
import {ignoreClientHangUps} from '../ccc-koa/client-abort.ts'
import {conditionalGet} from '../ccc-koa/conditional-get.ts'
import {ctxCacheControl} from '../ccc-koa/ctx-cache-control.ts'

export const InstitutionSchema = z.enum(['stolaf-college', 'carleton-college', 'all'])

/// Each institution's routes are also served under the campus prefix the
/// Worker uses (`/edu.stolaf/v1/...`), so one app build can talk to either
/// server.
export const CAMPUS_PREFIXES = {
	'stolaf-college': '/edu.stolaf',
	'carleton-college': '/edu.carleton',
} as const

export async function createApp(institution: z.infer<typeof InstitutionSchema>) {
	const app = new Koa(BEHIND_NGINX)
	ignoreClientHangUps(app)

	//
	// set up the routes
	//
	const router = new Router<RouterState, ContextState>()
	if (institution === 'all') {
		router.get('/ping', (ctx) => {
			ctx.body = 'pong'
		})
		const [stolaf, carleton] = await Promise.all([
			import('../ccci-stolaf-college/index.ts'),
			import('../ccci-carleton-college/index.ts'),
		])
		router.use('/stolaf', stolaf.api.routes())
		router.use('/carleton', carleton.api.routes())
		router.use(CAMPUS_PREFIXES['stolaf-college'], stolaf.api.routes())
		router.use(CAMPUS_PREFIXES['carleton-college'], carleton.api.routes())
	} else {
		const {api} = await (institution === 'stolaf-college'
			? import('../ccci-stolaf-college/index.ts')
			: import('../ccci-carleton-college/index.ts'))
		router.use(api.routes())
		router.use(CAMPUS_PREFIXES[institution], api.routes())
	}

	//
	// attach middleware
	//

	// logging
	app.use(accessLog())

	// automatically compress responses (TODO: delegate to nginx?)
	app.use(compress())

	// etag works together with conditional-get
	app.use(conditionalGet())
	app.use(etag())

	// support adding cache-control headers
	ctxCacheControl(app)

	// parse request bodies
	withBodyParsers(app)

	// hook in the router
	app.use(router.routes())
	app.use(router.allowedMethods())

	return app
}
