import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import compress from 'koa-compress'
import logger from 'koa-logger'
import responseTime from 'koa-response-time'
import zodRouter from 'koa-zod-router'
import Koa from 'koa'
import * as Sentry from '@sentry/node'
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi'
import {z} from 'zod'
import {errorMap} from 'zod-validation-error'

import koaCash from 'koa-cash'
import { LRUCache } from 'lru-cache'

extendZodWithOpenApi(z)
z.setErrorMap(errorMap)

const InstitutionSchema = z.enum(['stolaf-college', 'carleton-college'])

async function main() {
	const smokeTesting = Boolean(process.env['SMOKE_TEST'])

	const institutionResult = InstitutionSchema.safeParse(process.env['INSTITUTION'])
	if (institutionResult.error) {
		console.error(`the INSTITUTION environment variable must be one of ${InstitutionSchema.options.join(', ')}`)
		process.exit(1)
	}
	const institution = institutionResult.data

	const app = new Koa()

	//
	// set up the routes
	//
	const router = zodRouter({
		zodRouter: {exposeRequestErrors: true, exposeResponseErrors: true},
	})

	switch (institution) {
		case 'carleton-college': {
			let {v1} = await import('../ccci-carleton-college/index.js')
			router.use(v1.routes())
			break
		}
		case 'stolaf-college': {
			let {v1} = await import('../ccci-stolaf-college/index.js')
			router.use(v1.routes())
			break
		}
	}

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
	// cacheControl(app)

	//
	// set up caching
	//
	const cache = new LRUCache({ max: 500 })

	app.use(koaCash({
		get(key, maxAge) {
		  return Promise.resolve(cache.get(key))
		},
		set(key, value: string) {
			cache.set(key, value)
			return Promise.resolve()
		}
	  }))

	app.use(async (ctx, next) => {
		if (await ctx.cashed()) {
			return
		}
		await next()
	})

	//
	// set up cache flushing per-endpoint
	//
	router.post('/flush', async (ctx) => {
		try {
			const {query} = ctx.request
			const endpoint = query['endpoint'] as string
	
			if (!endpoint) {
				ctx.status = 400
				ctx.body = { error: 'valid endpoint is required' }
				return
			}
	
			ctx.cashClear(endpoint)
			cache.delete(endpoint)
	
			ctx.status = 200
			ctx.body = { message: `cache cleared for ${endpoint}` }
		} catch(err: unknown) {
			ctx.body = { message: `error while trying to clear cache` }
		}
	})

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
