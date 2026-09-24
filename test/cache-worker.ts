import {Hono} from 'hono'
import {createApp} from '../source/ccc-worker/app.ts'
import {cacheFor, publicMaxAge} from '../source/ccc-worker/cache.ts'
import type {AppEnv} from '../source/ccc-worker/env.ts'
import {ONE_HOUR, ONE_MINUTE} from '../source/ccc-lib/constants.ts'

/// A Worker with one route per cache behavior, so cache.test.ts can check
/// cacheFor in the real runtime without depending on any school's routes.

let api = new Hono<AppEnv>().basePath('/v1')

api.get('/cached', cacheFor(ONE_HOUR), async (c) => {
	let response = await fetch('https://upstream.test/data')
	return c.json(await response.json())
})

api.get('/echo', cacheFor(ONE_HOUR), async (c) => {
	let response = await fetch(`https://upstream.test/echo?q=${c.req.query('q') ?? ''}`)
	return c.json(await response.json())
})

api.get('/short', cacheFor(ONE_HOUR), async (c) => {
	await fetch('https://upstream.test/short')
	c.header('Cache-Control', publicMaxAge(ONE_MINUTE))
	return c.json({short: true})
})

api.get('/plain', (c) => c.json({plain: true}))

api.get('/fails', cacheFor(ONE_HOUR), async (c) => {
	let response = await fetch('https://upstream.test/fails')
	return c.json({upstream: response.status}, 502)
})

export default createApp(api)
