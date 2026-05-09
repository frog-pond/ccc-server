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
	let cache = new QuickLRU<string, CacheObject | undefined>({maxSize: 10_000, maxAge: ONE_DAY})
	app.use(
		cachable({
			setCachedHeader: true,
			get(key) {
				return cache.get(key)
			},
			set(key, value, maxAge = ONE_DAY) {
				if (value === undefined) {
					cache.delete(key)
					return
				}
				cache.set(key, value, {maxAge})
			},
		}),
	)

	router.get('/_cache', (ctx) => {
		if (ctx.cached(10000)) return
		let result = new Map()
		for (const key of cache.keys()) {
			result.set(key, Math.floor((cache.expiresIn(key) ?? 0) / 1000).toFixed(0))
		}
		ctx.body = Object.fromEntries(result.entries())
	})

	router.delete('/_cache', (ctx) => {
		let keys = ctx.URL.searchParams.getAll('key')
		if (keys.length) {
			let found = 0
			for (let key of keys) {
				let didDelete = cache.delete(key)
				if (didDelete) found++
			}
			ctx.response.set('X-Cache-Deleted', found.toFixed(0))
		} else {
			let size = cache.size
			cache.clear()
			ctx.response.set('X-Cache-Deleted', size.toFixed(0))
		}
		ctx.status = 204
	})

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
	const port = Number.parseInt(PORT, 10)
	app.listen(port)
	console.log(`listening on port ${PORT}`)

	if (process.env['ADVERTISE_MDNS'] === '1') {
		const {hostname} = await import('node:os')
		const serviceName = `ccc-server (${hostname()})`

		if (process.platform === 'darwin') {
			// On macOS, delegate to dns-sd so registration goes through the system
			// mDNSResponder. A pure-JS mDNS stack competing on port 5353 triggers
			// Bonjour name-conflict dialogs and can rename the host.
			const {spawn} = await import('node:child_process')
			const child = spawn(
				'dns-sd',
				['-R', serviceName, '_ccc-server._tcp', 'local', String(port), `institution=${institution}`, 'path=/v1/'],
				{stdio: 'ignore', detached: false},
			)
			console.log(`advertising mDNS service: ${serviceName}._ccc-server._tcp on port ${String(port)}`)

			const teardown = () => child.kill()
			process.once('SIGTERM', teardown)
			process.once('SIGINT', teardown)
		} else {
			const {Bonjour} = await import('bonjour-service')
			const bonjour = new Bonjour()
			const service = bonjour.publish({
				name: serviceName,
				type: 'ccc-server',
				port,
				txt: {institution, path: '/v1/'},
			})
			console.log(`advertising mDNS service: ${service.name}._ccc-server._tcp on port ${String(port)}`)

			const teardown = () => {
				service.stop?.(() => {
					// bonjour.destroy() returns any; call without returning
					bonjour.destroy()
				})
			}
			process.once('SIGTERM', teardown)
			process.once('SIGINT', teardown)
		}
	}
}

await main()
