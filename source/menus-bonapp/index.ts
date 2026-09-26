import {getJson, getText} from '../ccc-lib/http.ts'
import {CafeMenuIsClosed, CafeMenuWithError, CustomCafe, campusToday} from './helpers.ts'
import {
	CafeInfoResponseSchema,
	CafeMenuResponseSchema,
	type CafeInfoResponseType,
	type CafeMenuResponseType,
} from './types.ts'

import {BamcoPageContentsSchema} from './types-bonapp.ts'
import {extractBamco} from './extract-bamco.ts'

export function cafeFromHtml(html: string): CafeInfoResponseType {
	let bamco = BamcoPageContentsSchema.parse(extractBamco(html))
	if (typeof bamco === 'undefined') {
		return CustomCafe('Café is closed')
	}

	return CafeInfoResponseSchema.parse({
		cafe: {
			name: bamco.current_cafe.name,
			days: [
				{
					date: campusToday(),
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

export async function _cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	return cafeFromHtml(await getText(cafeUrl.toString()))
}

/// BonApp data, or a stand-in when BonApp can't be loaded. `fallback` says
/// which, so the stand-in can be kept out of the cache.
export interface BonAppResult<T> {
	data: T
	fallback: boolean
}

/// Errors become a café with a message instead of a failed request, so the app
/// shows why the café is missing.
export async function cafe(cafeUrl: string | URL): Promise<BonAppResult<CafeInfoResponseType>> {
	try {
		return {data: await _cafe(cafeUrl), fallback: false}
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		return {data: CustomCafe('Could not load café from BonApp'), fallback: true}
	}
}

export function nutrition(itemId: string) {
	return getJson('https://legacy.cafebonappetit.com/api/2/items', {searchParams: {item: itemId}})
}

export function menuFromHtml(html: string): CafeMenuResponseType {
	let bamco = BamcoPageContentsSchema.parse(extractBamco(html))
	if (typeof bamco === 'undefined') {
		return CafeMenuIsClosed()
	}

	return CafeMenuResponseSchema.parse({
		cor_icons: Array.isArray(bamco.cor_icons) ? {} : bamco.cor_icons,
		items: bamco.menu_items,
		days: [
			{
				date: campusToday(),
				cafe: {
					name: bamco.current_cafe.name,
					menu_id: '1',
					dayparts: [Object.values(bamco.dayparts)],
				},
			},
		],
	})
}

export async function _menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	return menuFromHtml(await getText(cafeUrl.toString()))
}

export async function menu(cafeUrl: string | URL): Promise<BonAppResult<CafeMenuResponseType>> {
	try {
		return {data: await _menu(cafeUrl), fallback: false}
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		let data = CafeMenuWithError(
			err && typeof err === 'object' && 'message' in err && err.message,
			'Could not load the BonApp menu data',
		)
		return {data, fallback: true}
	}
}
