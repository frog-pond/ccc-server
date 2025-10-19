import etag from '@koa/etag'
import compress from 'koa-compress'
import {withBodyParsers} from '@koa/body-parsers'
import Router from '@koa/router'
import Koa from 'koa'
import * as Sentry from '@sentry/node'
import {z} from 'zod'
import type {ContextState, RouterState} from './context.ts'
import {accessLog} from '../ccc-koa/access-log.ts'
import {conditionalGet} from '../ccc-koa/conditional-get.ts'
import {ctxCacheControl} from '../ccc-koa/ctx-cache-control.ts'
import {cachable, type CacheObject} from '../ccc-koa/cache.ts'
import QuickLRU from 'quick-lru'
import {ONE_DAY} from '../ccc-lib/constants.ts'

const InstitutionSchema = z.enum(['stolaf-college', 'carleton-college'])

async function main() {
	const smokeTesting = Boolean(process.env['SMOKE_TEST'])

	const rawInstitution = process.env['INSTITUTION']
	Sentry.setTag('INSTITUTION', rawInstitution)

	const institutionResult = InstitutionSchema.safeParse(process.env['INSTITUTION'])
	if (institutionResult.error) {
		console.error(
			`the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}, but got: ${String(rawInstitution)}`,
		)
		Sentry.logger.error(
			`the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}`,
		)
		process.exit(1)
	}
	const institution = institutionResult.data

	let v1: Router<RouterState, ContextState>
	switch (institution) {
		case 'carleton-college':
			v1 = (await import('../ccci-carleton-college/index.ts')).v1
			break
		case 'stolaf-college':
			v1 = (await import('../ccci-stolaf-college/index.ts')).v1
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

	// add cached response support at the Koa level
	// (individual route handlers can use ctx.cache to set caching parameters)
	let cache = new QuickLRU<string, CacheObject|undefined>({maxSize: 10_000, maxAge: ONE_DAY})
	app.use(
		cachable({
			maxAge: ONE_DAY,
			setCachedHeader: true,
			get: (key) => cache.get(key),
			set: (key, value) => {
				if (value === undefined) {
					cache.delete(key)
					return
				}
				cache.set(key, value)
			},
		}),
	)

	// hook in the router
	app.use(router.routes())
	app.use(router.allowedMethods())

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
