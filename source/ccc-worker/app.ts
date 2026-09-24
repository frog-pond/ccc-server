import {Hono} from 'hono'
import {etag} from 'hono/etag'
import type {AppEnv} from './env.ts'

export function createApp(v1: Hono<AppEnv>): Hono<AppEnv> {
	let app = new Hono<AppEnv>()

	// covers routes without cacheFor; cached routes already carry an ETag,
	// which this keeps
	app.use(etag())

	app.get('/', (c) => c.text('Hello world!'))
	app.get('/ping', (c) => c.text('pong'))
	app.route('/', v1)

	return app
}
