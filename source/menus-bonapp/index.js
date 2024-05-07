import {get} from '../ccc-lib/http.js'
import {ONE_MINUTE} from '../ccc-lib/constants.js'
import {JSDOM, VirtualConsole} from 'jsdom'
import * as Sentry from '@sentry/node'
import pMemoize from 'p-memoize'
import ExpiryMap from 'expiry-map'
import {CafeMenuIsClosed, CafeMenuWithError, CustomCafe} from './helpers.js'
import {BamcoCafeInfo, BamcoPageContents, CafeMenu} from './types.js'

const cache = new ExpiryMap(ONE_MINUTE)

/**
 * @param {string} url
 * @return {Promise<JSDOM>}
 */
async function _getBonAppWebpage(url) {
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

	const body = await get(url).text()
	return new JSDOM(body, {
		runScripts: 'dangerously',
		virtualConsole,
	})
}

const getBonAppWebpage = pMemoize(_getBonAppWebpage, {cache})

/**
 * @param {string|URL} cafeUrl
 * @returns {Promise<BamcoCafeInfo>}
 */
export async function _cafe(cafeUrl) {
	let today = new Date()
	let dom = await getBonAppWebpage(cafeUrl.toString())

	let bamco = BamcoPageContents.parse(dom.window.Bamco)
	if (typeof bamco === 'undefined') {
		return CustomCafe({message: 'Café is closed'})
	}

	return BamcoCafeInfo.parse({
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

/**
 * @param {string|URL} cafeUrl
 * @returns {Promise<BamcoCafeInfo>}
 */
export function cafe(cafeUrl) {
	try {
		return _cafe(cafeUrl)
	} catch (err) {
		console.error(err)
		Sentry.isInitialized() && Sentry.captureException(err)
		return CustomCafe({message: 'Could not load café from BonApp'})
	}
}

export function nutrition(itemId) {
	let url = 'https://legacy.cafebonappetit.com/api/2/items'
	return get(url, {searchParams: {item: itemId}}).json()
}

/**
 * @param {string|URL} cafeUrl
 * @returns {Promise<CafeMenu>}
 */
export async function _menu(cafeUrl) {
	let today = new Date()
	let dom = await getBonAppWebpage(cafeUrl.toString())

	let bamco = BamcoPageContents.parse(dom.window.Bamco)
	if (typeof bamco === 'undefined') {
		return CafeMenuIsClosed()
	}

	return CafeMenu.parse({
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

/**
 * @param {string|URL} cafeUrl
 * @returns {Promise<CafeMenu>}
 */
export function menu(cafeUrl) {
	try {
		return _menu(cafeUrl)
	} catch (err) {
		console.error(err)
		Sentry.isInitialized() && Sentry.captureException(err)
		return CafeMenuWithError(err.message, 'Could not load the BonApp menu data')
	}
}
