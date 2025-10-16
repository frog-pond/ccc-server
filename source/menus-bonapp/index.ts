import {getJson, getText} from '../ccc-lib/http.ts'
import {ONE_MINUTE} from '../ccc-lib/constants.ts'
import {JSDOM, VirtualConsole} from 'jsdom'
import * as Sentry from '@sentry/node'
import mem from 'memoize'
import {CafeMenuIsClosed, CafeMenuWithError, CustomCafe} from './helpers.ts'
import {
	CafeInfoResponseSchema,
	CafeMenuResponseSchema,
	type CafeInfoResponseType,
	type CafeMenuResponseType,
} from './types.ts'

import {BamcoPageContentsSchema} from './types-bonapp.ts'

const _getBamcoPage = mem((url: string) => getText(url), {maxAge: ONE_MINUTE})

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
		Sentry.captureException(err)
	})

	const body = await _getBamcoPage(url.toString())
	return new JSDOM(body, {
		runScripts: 'dangerously',
		virtualConsole,
	})
}

export async function _cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	let today = new Date()
	let dom = await getBonAppWebpage(cafeUrl)

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

export function cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	try {
		return _cafe(cafeUrl)
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		Sentry.captureException(err)
		return Promise.resolve(CustomCafe('Could not load café from BonApp'))
	}
}

export function nutrition(itemId: string) {
	let url = 'https://legacy.cafebonappetit.com/api/2/items'
	return getJson(url, {searchParams: {item: itemId}})
}

export async function _menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	let today = new Date()
	let dom = await getBonAppWebpage(cafeUrl)

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

export function menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	try {
		return _menu(cafeUrl)
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		Sentry.captureException(err)
		return Promise.resolve(
			CafeMenuWithError(
				err && typeof err === 'object' && 'message' in err && err.message,
				'Could not load the BonApp menu data',
			),
		)
	}
}
