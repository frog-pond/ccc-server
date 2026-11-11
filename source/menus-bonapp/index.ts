import {getJson, getText} from '../ccc-lib/http.ts'
import * as Sentry from '@sentry/node'
import {CafeMenuWithError, CustomCafe, campusToday} from './helpers.ts'
import {cafeFrom, cafeUrlForDate, menuDates, menuFromPages, settled} from './shape.ts'
import type {CafeInfoResponseType, CafeMenuResponseType} from './types.ts'

import {BamcoPageContentsSchema} from './types-bonapp.ts'
import {extractBamco} from './extract-bamco.ts'
import {feedName, recordFeedFailure, recordFeedItems} from '../ccc-lib/feed-metrics.ts'

/// Each stage of turning a café page into our data, as a span, so a slow
/// request's trace shows which one took the time.
const stage = <T>(name: string, fn: () => T): T => Sentry.startSpan({name, op: 'function'}, fn)

interface MenuOptions {
	days?: 5
}

async function getBamco(url: string | URL) {
	let html = await getText(url.toString())
	let raw = stage('bonapp.extract', () => extractBamco(html))
	return stage('bonapp.validate', () => BamcoPageContentsSchema.parse(raw)) ?? null
}

export async function _cafe(cafeUrl: string | URL): Promise<CafeInfoResponseType> {
	return cafeFrom(await getBamco(cafeUrl), campusToday())
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

export async function _menu(
	cafeUrl: string | URL,
	options: MenuOptions = {},
): Promise<CafeMenuResponseType> {
	let pages = await Promise.all(
		menuDates(campusToday(), options.days ?? 1).map(async (date) => ({
			date,
			page: await settled(getBamco(cafeUrlForDate(cafeUrl, date))),
		})),
	)
	let loaded = pages.flatMap(({page}) => (page.status === 'fulfilled' ? [page.value] : []))
	// when nothing loaded, `menuFromPages` throws and `menu` reports the failure
	if (loaded.length > 0) {
		recordFeedItems(
			'bonapp',
			feedName(cafeUrl),
			loaded.reduce(
				(count, bamco) => count + (bamco ? Object.keys(bamco.menu_items).length : 0),
				0,
			),
			{closed: loaded.every((bamco) => bamco === null)},
		)
		// a day that failed while others loaded is an error for that day alone,
		// and never reaches `menu`'s catch, so it is reported here
		for (let {date, page} of pages) {
			if (page.status === 'fulfilled') continue
			console.error(page.reason, {cafeUrl: String(cafeUrl), date})
			Sentry.captureException(page.reason)
		}
	}

	return stage('bonapp.clean', () => menuFromPages(pages))
}

export async function menu(
	cafeUrl: string | URL,
	options: MenuOptions = {},
): Promise<CafeMenuResponseType> {
	try {
		return await _menu(cafeUrl, options)
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
