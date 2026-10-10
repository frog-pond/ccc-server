import {getJson, getText} from '../ccc-lib/http.ts'
import * as Sentry from '@sentry/node'
import {CafeMenuWithError, CustomCafe, campusToday} from './helpers.ts'
import {cafeFrom, menuFrom} from './shape.ts'
import type {CafeInfoResponseType, CafeMenuResponseType} from './types.ts'

import {BamcoPageContentsSchema} from './types-bonapp.ts'
import {extractBamco} from './extract-bamco.ts'
import {feedName, recordFeedFailure, recordFeedItems} from '../ccc-lib/feed-metrics.ts'

/// Each stage of turning a café page into our data, as a span, so a slow
/// request's trace shows which one took the time.
const stage = <T>(name: string, fn: () => T): T => Sentry.startSpan({name, op: 'function'}, fn)

async function getBamco(url: string | URL) {
	let html = await getText(url.toString())
	let raw = stage('bonapp.extract', () => extractBamco(html))
	return stage('bonapp.validate', () => BamcoPageContentsSchema.parse(raw))
}

export async function _cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	return cafeFrom((await getBamco(cafeUrl)) ?? null, campusToday())
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
	let bamco = (await getBamco(cafeUrl)) ?? null
	// a closed café is also what a page BonApp has reshaped past reading looks like
	recordFeedItems('bonapp', feedName(cafeUrl), bamco ? Object.keys(bamco.menu_items).length : 0, {
		closed: bamco === null,
	})

	return stage('bonapp.clean', () => menuFrom(bamco, campusToday()))
}

export async function menu(cafeUrl: string | URL): Promise<CafeMenuResponseType> {
	try {
		return await _menu(cafeUrl)
	} catch (err) {
		console.error(err, {cafeUrl: String(cafeUrl)})
		Sentry.captureException(err)
		recordFeedFailure('bonapp', feedName(cafeUrl))
		return CafeMenuWithError(
			err && typeof err === 'object' && 'message' in err && err.message,
			'Could not load the BonApp menu data',
		)
	}
}
