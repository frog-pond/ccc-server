import {get} from '../ccc-lib/http.js'
import {ONE_MINUTE} from '../ccc-lib/constants.js'
import {JSDOM, VirtualConsole} from 'jsdom'
import * as Sentry from '@sentry/node'
import mem from 'memoize'
import {CafeMenuIsClosed, CafeMenuWithError, CustomCafe} from './helpers.js'
import {
	CafeInfoResponseSchema,
	CafeMenuResponseSchema,
	type CafeInfoResponseType,
	type CafeMenuResponseType,
} from './types.js'
import {fetchCafe as fetchCafeV2, fetchItem as fetchItemV2, fetchMenu as fetchMenuV2} from './v2.js'
import type {CafesResponseSchema as CafeV2, MenuResponseSchema as MenuV2} from './v2/types.js'

import {BamcoPageContentsSchema} from './types-bonapp.js'

const _getBamcoPage = mem((url: string) => get(url).text(), {maxAge: ONE_MINUTE})

async function getBonAppWebpage(url: string | URL) {
	const virtualConsole = new VirtualConsole()
	virtualConsole.sendTo(console, {omitJSDOMErrors: true})
	virtualConsole.on('jsdomError', (err) => {
		let messagesToSkip = [
			'Uncaught [ReferenceError: wp is not defined]',
			'Uncaught [ReferenceError: jQuery is not defined]',
		]
		if (messagesToSkip.includes(err.message)) {
			return
		}
		console.error(err)
	})

	const body = await _getBamcoPage(url.toString())
	return new JSDOM(body, {
		runScripts: 'dangerously',
		virtualConsole,
	})
}

function transformV2Cafe(cafe: ReturnType<typeof CafeV2["parse"]>, cafeId: string): CafeInfoResponseType {
	const today = new Date().toISOString().split('T')[0]
	const v2Cafe = cafe.cafes[cafeId]!
	return {
		cafe: {
			name: v2Cafe.name,
			days: [{
				date: today,
				dayparts: v2Cafe.days.find(d => d.date === today)?.dayparts ?? [],
			}],
		},
	}
}

function transformV2Menu(menu: ReturnType<typeof MenuV2["parse"]>, cafeId: string): CafeMenuResponseType {
	const today = new Date().toISOString().split('T')[0]
	const v2Cafe = menu.days.find(d => d.date === today)?.cafes[cafeId]!
	return {
		cor_icons: {}, // v2 does not provide cor_icons in the menu response
		items: menu.items,
		days: [
			{
				date: today,
				cafe: {
					name: v2Cafe.name,
					menu_id: v2Cafe.menu_id,
					dayparts: v2Cafe.dayparts.map(dp => ({
						...dp,
						stations: dp.stations.map(s => ({
							...s,
							items: s.items.map(i => i.id)
						}))
					})),
				},
			},
		],
	}
}

export async function _cafe(dom: JSDOM): Promise<CafeInfoResponseType> {
	let today = new Date()

	let bamco = BamcoPageContentsSchema.parse(dom.window['Bamco'])
	if (typeof bamco === 'undefined') {
		return CustomCafe('Café is closed')
	}

	return CafeInfoResponseSchema.parse({
		cafe: {
			name: bamco.current_cafe.name,
			days: [
				{
					date: today.toISOString().split('T')[0],
					dayparts: Object.values(bamco.dayparts).map(
						({id, label, message, starttime, endtime}) => ({
							id,
							label,
							message,
							starttime,
							endtime,
						}),
					),
				},
			],
		},
	})
}

export async function cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	const dom = await getBonAppWebpage(cafeUrl)
	try {
		const bamco = BamcoPageContentsSchema.parse(dom.window['Bamco'])
		if (bamco) {
			const cafeId = String(bamco.current_cafe.id)
			const v2Cafe = await fetchCafeV2(cafeId)
			return transformV2Cafe(v2Cafe, cafeId)
		}
	} catch (err) {
		console.error(err)
		Sentry.captureException(err)
	}

	try {
		return await _cafe(dom)
	} catch (err) {
		console.error(err)
		Sentry.captureException(err)
		return Promise.resolve(CustomCafe('Could not load café from BonApp'))
	}
}

export async function nutrition(itemId: string) {
	try {
		return await fetchItemV2(itemId)
	} catch (err) {
		console.error(`v2 fetch failed for item ${itemId}, falling back to legacy`)
		Sentry.captureException(err)
	}
	let url = 'https://legacy.cafebonappetit.com/api/2/items'
	return get(url, {searchParams: {item: itemId}}).json()
}

export async function _menu(dom: JSDOM): Promise<CafeMenuResponseType> {
	let today = new Date()

	let bamco = BamcoPageContentsSchema.parse(dom.window['Bamco'])
	if (typeof bamco === 'undefined') {
		return CafeMenuIsClosed()
	}

	return CafeMenuResponseSchema.parse({
		cor_icons: Array.isArray(bamco.cor_icons) ? {} : bamco.cor_icons,
		items: bamco.menu_items,
		days: [
			{
				date: today.toISOString().split('T')[0],
				cafe: {
					name: bamco.current_cafe.name,
					menu_id: '1',
					dayparts: [Object.values(bamco.dayparts)],
				},
			},
		],
	})
}

export async function menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	const dom = await getBonAppWebpage(cafeUrl)
	try {
		const bamco = BamcoPageContentsSchema.parse(dom.window['Bamco'])
		if (bamco) {
			const cafeId = String(bamco.current_cafe.id)
			const v2Menu = await fetchMenuV2(cafeId)
			return transformV2Menu(v2Menu, cafeId)
		}
	} catch (err) {
		console.error(err)
		Sentry.captureException(err)
	}

	try {
		return await _menu(dom)
	} catch (err) {
		console.error(err)
		Sentry.captureException(err)
		return Promise.resolve(
			CafeMenuWithError(
				err && typeof err === 'object' && 'message' in err && err.message,
				'Could not load the BonApp menu data',
			),
		)
	}
}
