import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import compress from 'koa-compress'
import logger from 'koa-logger'
import responseTime from 'koa-response-time'
import Router from 'koa-router'
import Koa from 'koa'

async function main() {
	const institution = process.env.INSTITUTION
	const {v1} = await import(`./institutions/${institution}/v1/index.mjs`)

	const app = new Koa()

	//
	// set up the routes
	//
	const router = new Router()
	router.use(v1.routes())

	router.get('/', async ctx => {
		ctx.body = `Hello world! Prefix: ${ctx.route.prefix}`
	})

	router.get('/ping', async ctx => {
		ctx.body = 'pong'
	})

	// router.getRoutes().forEach(route => console.log(route.path))

	//
	// attach middleware
	//
	app.use(responseTime())
	app.use(logger())
	app.use(compress())
	// etag works together with conditional-get
	app.use(conditional())
	app.use(etag())
	// hook in the router
	app.use(router.routes())
	app.use(router.allowedMethods())

	//
	// start the app
	//
	const PORT = process.env.NODE_PORT || '3000'
	app.listen(Number.parseInt(PORT, 10))
	console.log(`listening on port ${PORT}`)
}

main()
