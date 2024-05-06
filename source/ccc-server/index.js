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
// import {sentryRequestHandler, sentryTracingMiddleware} from './sentry.js'

function setupSentry() {
	const dsn = process.env.SENTRY_DSN
	if (!dsn) {
		console.warn('no SENTRY_DSN set, not starting Sentry')
		return
	}

	const environment = process.env.NODE_ENV || 'development'

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

async function main() {
	const smokeTesting = process.env.SMOKE_TEST || false

	if (!smokeTesting) {
		setupSentry()
	}

	const institution = process.env.INSTITUTION
	if (!institution || institution === 'unknown') {
		console.error(
			'please add -e INSTITUTION=$place to your docker run, or set the environment variable in some way',
		)
		process.exit(1)
	}

	const {v1} = await import(`../ccci-${institution}/index.js`)

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
	app.on('error', (err, ctx) => {
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

	const PORT = process.env.NODE_PORT || '3000'
	app.listen(Number.parseInt(PORT, 10))
	console.log(`listening on port ${PORT}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})