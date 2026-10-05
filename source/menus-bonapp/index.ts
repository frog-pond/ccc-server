import {getJson, getText} from '../ccc-lib/http.ts'
import * as Sentry from '@sentry/node'
import {CafeMenuIsClosed, CafeMenuWithError, CustomCafe, campusToday} from './helpers.ts'
import {cleanDayPart, cleanMenuItem} from './clean.ts'
import {
	CafeInfoResponseSchema,
	CafeMenuResponseSchema,
	type CafeInfoResponseType,
	type CafeMenuResponseType,
} from './types.ts'

import {BamcoPageContentsSchema} from './types-bonapp.ts'
import {extractBamco} from './extract-bamco.ts'

/// Each stage of turning a café page into our data, as a span, so a slow
/// request's trace shows which one took the time.
const stage = <T>(name: string, fn: () => T): T => Sentry.startSpan({name, op: 'function'}, fn)

async function getBamco(url: string | URL) {
	let html = await getText(url.toString())
	let raw = stage('bonapp.extract', () => extractBamco(html))
	return stage('bonapp.validate', () => BamcoPageContentsSchema.parse(raw))
}

export async function _cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	let bamco = await getBamco(cafeUrl)
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

export async function cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	try {
		return await _cafe(cafeUrl)
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		Sentry.captureException(err)
		return CustomCafe('Could not load café from BonApp')
	}
}

export function nutrition(itemId: string) {
	return getJson('https://legacy.cafebonappetit.com/api/2/items', {searchParams: {item: itemId}})
}

export async function _menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	let bamco = await getBamco(cafeUrl)
	if (typeof bamco === 'undefined') {
		return CafeMenuIsClosed()
	}

	let {items, dayparts} = stage('bonapp.clean', () => ({
		items: Object.fromEntries(
			Object.entries(bamco.menu_items).map(([id, item]) => [id, cleanMenuItem(item)]),
		),
		dayparts: Object.values(bamco.dayparts).map(cleanDayPart),
	}))

	return CafeMenuResponseSchema.parse({
		cor_icons: Array.isArray(bamco.cor_icons) ? {} : bamco.cor_icons,
		items,
		days: [
			{
				date: campusToday(),
				cafe: {
					name: bamco.current_cafe.name,
					menu_id: '1',
					dayparts: [dayparts],
				},
			},
		],
	})
}

export async function menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	try {
		return await _menu(cafeUrl)
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		Sentry.captureException(err)
		return CafeMenuWithError(
			err && typeof err === 'object' && 'message' in err && err.message,
			'Could not load the BonApp menu data',
		)
	}
}
