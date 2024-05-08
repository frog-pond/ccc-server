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
import {nodeProfilingIntegration} from '@sentry/profiling-node'
import {z} from 'zod'
// import {sentryRequestHandler, sentryTracingMiddleware} from './sentry.js'

function setupSentry() {
	const dsn = process.env['SENTRY_DSN']
	if (!dsn) {
		console.warn('no SENTRY_DSN set, not starting Sentry')
		return
	}

	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	const environment = process.env['NODE_ENV'] || 'development'

	Sentry.init({
		dsn,
		environment,
		integrations: [
			nodeProfilingIntegration(),
			...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
		],
		// Performance Monitoring
		tracesSampleRate: 1.0,
		profilesSampleRate: 1.0,
	})
}

const InstitutionSchema = z.enum(['stolaf-college', 'carleton-college'])

async function main() {
	const smokeTesting = Boolean(process.env['SMOKE_TEST'])

	if (!smokeTesting) {
		setupSentry()
	}

	const institutionResult = InstitutionSchema.safeParse(
		process.env['INSTITUTION'],
	)
	if (institutionResult.error) {
		console.error(
			`the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}`,
		)
		process.exit(1)
	}
	const institution = institutionResult.data

	let v1: Router
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
	const router = new Router()
	router.use(v1.routes())

	router.get('/', (ctx) => {
		ctx.body = 'Hello world!'
	})

	router.get('/ping', (ctx) => {
		ctx.body = 'pong'
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
	// parse request bodies
	app.use(bodyParser())
	// hook in the router
	app.use(router.routes())
	app.use(router.allowedMethods())

	// capture errors and send to Sentry too, not just the console.
	app.on('error', (err: Error, ctx: Koa.Context) => {
		console.error(err)
		Sentry.isInitialized() &&
			Sentry.withScope((scope) => {
				scope.setSDKProcessingMetadata({request: ctx.request})
				Sentry.captureException(err)
			})
	})

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
