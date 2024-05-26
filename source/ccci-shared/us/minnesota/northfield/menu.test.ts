import baseTest, {type TestFn} from 'ava'
import Koa from 'koa'
import {listen} from 'async-listen'

import {CafeInfoResponseSchema, CafeMenuResponseSchema, PauseMenuSchema} from '../../../../menus-bonapp/types.js'
import {keysOf} from '../../../../ccc-lib/keysOf.js'

import * as menu from './menu.js'
import zodRouter from 'koa-zod-router'
import * as http from 'node:http'
import ky from 'ky'

const test = baseTest as TestFn<{server: http.Server; prefixUrl: URL}>

test.before(async (t) => {
	let app = new Koa()
	let router = zodRouter({zodRouter: {exposeRequestErrors: true, exposeResponseErrors: true}})

	router.register(menu.getBonAppItemNutritionRoute)
	router.register(menu.getBonAppMenuRoute)
	router.register(menu.getBonAppCafeRoute)
	router.register(menu.getNamedMenuRoute)
	router.register(menu.getNamedCafeRoute)

	app.use(router.routes())

	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	t.context.server = http.createServer(app.callback())
	t.context.prefixUrl = await listen(t.context.server)
})

test.after.always((t) => {
	t.context.server.close()
})

test('the pause menu endpoint should return a PauseMenuSchema struct', async (t) => {
	let {prefixUrl} = t.context
	let response = await ky('food/named/menu/the-pause', {prefixUrl})
	t.is(response.status, 200)
	await t.notThrowsAsync(async () => PauseMenuSchema.parse(await response.json()))
})

for (const cafeSlug of keysOf(menu.BamcoSlugToUrl)) {
	test(`/cafeSlug endpoint for ${JSON.stringify(cafeSlug)} should return a CafeInfoResponseSchema struct`, async (t) => {
		let {prefixUrl} = t.context
		let response = await ky(`food/named/cafe/${cafeSlug}`, {prefixUrl, throwHttpErrors: false})
		t.is(response.status, 200)
		await t.notThrowsAsync(async () => CafeInfoResponseSchema.parse(await response.json()))
	})

	test(`/menu endpoint for ${JSON.stringify(cafeSlug)} should return a CafeMenuResponseSchema struct`, async (t) => {
		let {prefixUrl} = t.context
		let response = await ky(`food/named/menu/${cafeSlug}`, {prefixUrl, throwHttpErrors: false})
		t.is(response.status, 200)
		await t.notThrowsAsync(async () => CafeMenuResponseSchema.parse(await response.json()))
	})
}

for (const cafeId of keysOf(menu.BamcoIdToSlug)) {
	test(`/cafe endpoint for id=${cafeId} should return a CafeInfoResponseSchema struct`, async (t) => {
		let {prefixUrl} = t.context
		let response = await ky(`food/cafe/${cafeId}`, {prefixUrl, throwHttpErrors: false})
		t.is(response.status, 200)
		await t.notThrowsAsync(async () => CafeInfoResponseSchema.parse(await response.json()))
	})

	test(`/cafe endpoint for id=${cafeId} should return a CafeMenuResponseSchema struct`, async (t) => {
		let {prefixUrl} = t.context
		let response = await ky(`food/menu/${cafeId}`, {prefixUrl, throwHttpErrors: false})
		t.is(response.status, 200)
		await t.notThrowsAsync(async () => CafeMenuResponseSchema.parse(await response.json()))
	})
}

test('/cafe endpoint for an unknown cafe ID should return a 400', async (t) => {
	let {prefixUrl} = t.context
	let response = await ky('food/cafe/0', {prefixUrl, throwHttpErrors: false})
	t.is(response.status, 400)
	t.like(await response.json(), {
		error: {
			params: {
				name: 'ZodError',
				issues: [{code: 'invalid_enum_value', path: ['cafeId']}],
			},
		},
	})
})

test('/cafe endpoint for an unknown cafe name should return a 400', async (t) => {
	let {prefixUrl} = t.context
	let response = await ky('food/named/cafe/googoool', {prefixUrl, throwHttpErrors: false})
	t.is(response.status, 400)
	t.like(await response.json(), {
		error: {
			params: {
				name: 'ZodError',
				issues: [{code: 'invalid_union', message: 'Invalid input', path: ['cafeName']}],
			},
		},
	})
})
