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

/// Errors become a café with a message instead of a failed request, so the app
/// shows why the café is missing.
export async function cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	try {
		return await _cafe(cafeUrl)
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		return CustomCafe('Could not load café from BonApp')
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

export async function menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	try {
		return await _menu(cafeUrl)
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		return CafeMenuWithError(
			err && typeof err === 'object' && 'message' in err && err.message,
			'Could not load the BonApp menu data',
		)
	}
}
