import baseTest, {type TestFn} from 'ava'
import request from 'supertest'
import Koa from 'koa'
import {listen} from 'async-listen'

import {CafeInfoResponseSchema, CafeMenuResponseSchema} from '../../../../menus-bonapp/types.js'
import {keysOf} from '../../../../ccc-lib/keysOf.js'

import * as menu from './menu.js'
import zodRouter from 'koa-zod-router'
import logger from 'koa-logger'
import * as http from 'node:http'

const test = baseTest as TestFn<{server: Koa}>

test.before((t) => {
	let server = new Koa()
	let router = zodRouter({zodRouter: {exposeRequestErrors: true, exposeResponseErrors: true}})

	router.register(menu.getBonAppItemNutritionRoute)
	router.register(menu.getBonAppMenuRoute)
	router.register(menu.getBonAppCafeRoute)
	router.register(menu.getNamedMenuRoute)
	router.register(menu.getNamedCafeRoute)

	server.use(router.routes())

	t.context.server = server
})

test('example', async (t) => {
	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	let baseUrl = await listen(http.createServer(t.context.server.callback()))
	await fetch(`${baseUrl.href}/food/named/menu/the-pause`)
})

/*
for (const cafe of keysOf(menu.CAFE_URLS)) {
	test(`${cafe} cafe endpoint should return a BamcoCafeInfo struct`, async (t) => {
		await t.notThrowsAsync(
			request(t.context.server.listen())
				.get(`/food/cafe/${cafe}`)
				.expect('Content-Type', /^application\/json\b/)
				.expect(200)
				.expect((response) => CafeInfoResponseSchema.parse(response.body)),
		)
	})

	test(`${cafe} menu endpoint should return a BamcoCafeInfo struct`, async (t) => {
		await t.notThrowsAsync(
			request(t.context.server.listen())
				.get(`/food/menu/${cafe}`)
				.expect('Content-Type', /^application\/json\b/)
				.expect(200)
				.expect((response) => CafeMenuResponseSchema.parse(response.body)),
		)
	})
}
*/
