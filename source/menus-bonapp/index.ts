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

interface MenuOptions {
	days?: 5
}

function menuDates(today: string, count: number): string[] {
	return Array.from({length: count}, (_, offset) => {
		let date = new Date(`${today}T00:00:00Z`)
		date.setUTCDate(date.getUTCDate() + offset)
		return date.toISOString().slice(0, 10)
	})
}

function cafeUrlForDate(cafeUrl: string | URL, date: string): string {
	let url = new URL(cafeUrl)
	if (url.protocol === 'data:') return url.toString()
	url.pathname = `${url.pathname.replace(/\/\d{4}-\d{2}-\d{2}\/?$/, '').replace(/\/$/, '')}/${date}/`
	return url.toString()
}

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

export async function _menu(
	cafeUrl: string | URL,
	options: MenuOptions = {},
): Promise<CafeMenuResponseType> {
	let days = options.days ?? 1
	let dates = menuDates(campusToday(), days)
	let pages = await Promise.all(
		dates.map(async (date) => ({
			date,
			bamco: (await getBamco(days === 1 ? cafeUrl : cafeUrlForDate(cafeUrl, date))) ?? null,
		})),
	)
	recordFeedItems(
		'bonapp',
		feedName(cafeUrl),
		pages.reduce((count, {bamco}) => count + (bamco ? Object.keys(bamco.menu_items).length : 0), 0),
		{closed: pages.every(({bamco}) => bamco === null)},
	)

	return stage('bonapp.clean', () => {
		let menus = pages.map(({date, bamco}) => menuFrom(bamco, date))
		let firstMenu = menus[0]
		if (!firstMenu) throw new Error('BonApp menu date range is empty')
		let items = menus.reduce<CafeMenuResponseType['items']>((combined, menu) => {
			for (let [id, item] of Object.entries(menu.items)) {
				combined[id] = item
			}
			return combined
		}, {})
		return {
			...firstMenu,
			items,
			days: menus.flatMap((menu) => menu.days),
		}
	})
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
