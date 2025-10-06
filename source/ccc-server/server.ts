import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import compress from 'koa-compress'
import logger from 'koa-logger'
import responseTime from 'koa-response-time'
import bodyParser from 'koa-bodyparser'
import cacheControl from 'koa-ctx-cache-control'
import Router from 'koa-router'
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

	let v1: Router<RouterState, ContextState>
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
	const router = new Router<RouterState, ContextState>()
	router.use(v1.routes())

	router.get('/', (ctx) => {
		ctx.body = 'Hello world!'
	})

	router.get('/ping', (ctx) => {
		ctx.body = 'pong'
	})

	//
	// set up the graphql endpoint
	//
	const {graphql} = await import('./graphql/index.js')
	router.all('/graphql', graphql)

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
	// parse request bodies
	app.use(bodyParser())
	// hook in the router
	app.use(router.routes())
	app.use(router.allowedMethods())

	// I'm not sure why typescript-eslint was complaining about this...
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
