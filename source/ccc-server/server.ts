import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import compress from 'koa-compress'
import logger from 'koa-logger'
import responseTime from 'koa-response-time'
import cacheControl from 'koa-ctx-cache-control'
import zodRouter from 'koa-zod-router'
import Koa from 'koa'
import * as Sentry from '@sentry/node'
import {z} from 'zod'
import type {ContextState, RouterState} from './context.js'

const InstitutionSchema = z.enum(['stolaf-college', 'carleton-college'])

async function main() {
	const smokeTesting = Boolean(process.env['SMOKE_TEST'])

	const institutionResult = InstitutionSchema.safeParse(process.env['INSTITUTION'])
	if (institutionResult.error) {
		console.error(
			`the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}`,
		)
		process.exit(1)
	}
	const institution = institutionResult.data

	let v1: typeof zodRouter
	switch (institution) {
		case 'carleton-college':
			v1 = (await import('../ccci-carleton-college/index.js')).v1
			break
		case 'stolaf-college':
			v1 = (await import('../ccci-stolaf-college/index.js')).v1
			break
	}

	const app = new Koa()

	//
	// set up the routes
	//
	const router = zodRouter({
		zodRouter: {exposeRequestErrors: true, exposeResponseErrors: true},
	})

	router.use(v1.routes())

	router.get({
		name: 'hello-world',
		path: '/',
		validate: {
			query: z
				.object({
					greeting: z.string().default('Hello').describe('foo'),
					subject: z.string().default('world').describe('bar'),
				})
				.default({}),
			response: z.string(),
		},
		handler: (ctx) => {
			ctx.body = `${ctx.request.query.greeting} ${ctx.request.query.subject}`
		},
	})

	router.get({
		name: 'ping',
		path: '/ping',
		validate: {response: z.string()},
		handler: (ctx) => {
			ctx.body = 'pong'
		},
	})

	//
	// attach middleware
	//
	app.use(responseTime({hrtime: true}))
	app.use(logger())
	app.use(compress())
	// etag works together with conditional-get
	app.use(conditional())
	app.use(etag())
	// support adding cache-control headers
	cacheControl(app)
	// hook in the router
	app.use(router.routes())
	app.use(router.allowedMethods())
	// activate Sentry
	Sentry.setupKoaErrorHandler(app)

	//
	// start the app
	//

	if (smokeTesting) {
		return
	}

	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	const PORT = process.env['NODE_PORT'] || '3000'
	app.listen(Number.parseInt(PORT, 10))
	console.log(`listening on port ${PORT}`)
}

await main()
