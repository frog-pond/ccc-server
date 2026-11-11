import {cleanDayPart, cleanMenuItem} from './clean.ts'
import {
	CafeInfoResponseSchema,
	CafeMenuDayPartSchema,
	CafeMenuItemSchema,
	CafeMenuResponseSchema,
	type CafeInfoResponseType,
	type CafeMenuResponseType,
} from './types.ts'
import type {BamcoPageContents} from './types-bonapp.ts'

/// Turning a BonApp café page into what the apps are sent. Nothing here fetches
/// or reads the clock -- the page and the date are given -- so the Node server
/// and the Cloudflare Worker shape their responses with the same code.

export function CustomCafe(message: string, date: string) {
	return CafeInfoResponseSchema.parse({
		cafe: {
			name: 'Café',
			message,
			days: [
				{
					date,
					dayparts: [],
					message,
				},
			],
		},
	})
}

function CustomCafeMenuItem({
	id,
	station,
	sub_station,
	description,
	label,
}: {
	id: string
	station: string
	sub_station: string
	description: string
	label: string
}) {
	return CafeMenuItemSchema.parse({
		description,
		id,
		label,
		rating: '5',
		special: 1,
		station,
		sub_station,
		sub_station_id: '1',
		sub_station_order: '1',
		zero_entree: '0',
	})
}

/// A stand-in's one item is `1`, as the apps have always been sent, unless a
/// menu of several days needs each day's stand-in to have an id of its own.
export function CafeMenuIsClosed(date: string, itemId = '1') {
	return CafeMenuResponseSchema.parse({
		cor_icons: {},
		items: {
			[itemId]: CustomCafeMenuItem({
				id: itemId,
				description: 'Closed',
				label: 'Closed',
				station: 'Closed',
				sub_station: 'Closed',
			}),
		},
		days: [
			{
				date,
				cafe: {
					name: 'Unknown',
					menu_id: '1',
					dayparts: [
						[
							CustomCafeDayPart({
								itemId,
								abbreviation: 'CLSD',
								label: 'Closed',
								message: 'This café is currently closed.',
								note: '',
							}),
						],
					],
				},
			},
		],
	})
}

function CustomCafeDayPart({
	itemId,
	abbreviation,
	label,
	message,
	note,
}: {
	itemId: string
	abbreviation: string
	label: string
	message: string
	note: string
}) {
	return CafeMenuDayPartSchema.parse({
		abbreviation,
		endtime: '24:00',
		endtime_formatted: 'Twilight',
		id: '1',
		label,
		message,
		starttime: '00:00',
		starttime_formatted: 'Daybreak',
		time_formatted: 'All Day',
		stations: [
			{
				order_id: '1-1',
				id: '1',
				label: label,
				price: '',
				note,
				items: [itemId],
				soup: null,
			},
		],
	})
}

export function CafeMenuWithError(error: unknown, label: string, date: string, itemId = '1') {
	return CafeMenuResponseSchema.parse({
		cor_icons: {},
		items: {
			[itemId]: CustomCafeMenuItem({
				id: itemId,
				description: `Please email allaboutolaf@frogpond.tech: ${String(error)}`,
				label: label,
				station: 'error!?‽',
				sub_station: 'error…',
			}),
		},
		days: [
			{
				date,
				cafe: {
					name: 'Unknown',
					menu_id: '1',
					dayparts: [
						[
							CustomCafeDayPart({
								itemId,
								abbreviation: 'ERR',
								label: 'Errored',
								message: 'Error loading the BonApp menu data',
								note: String(error),
							}),
						],
					],
				},
			},
		],
	})
}

/// The café's info for a page; `null` is a closed café.
export function cafeFrom(bamco: BamcoPageContents | null, date: string): CafeInfoResponseType {
	if (bamco === null) {
		return CustomCafe('Café is closed', date)
	}

	return CafeInfoResponseSchema.parse({
		cafe: {
			name: bamco.current_cafe.name,
			days: [
				{
					date,
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

/// The menu for a page, with its text cleaned; `null` is a closed café.
export function menuFrom(bamco: BamcoPageContents | null, date: string): CafeMenuResponseType {
	if (bamco === null) {
		return CafeMenuIsClosed(date)
	}

	let items = Object.fromEntries(
		Object.entries(bamco.menu_items).map(([id, item]) => [id, cleanMenuItem(item)]),
	)
	let dayparts = Object.values(bamco.dayparts).map(cleanDayPart)

	return CafeMenuResponseSchema.parse({
		cor_icons: Array.isArray(bamco.cor_icons) ? {} : bamco.cor_icons,
		items,
		days: [
			{
				date,
				cafe: {
					name: bamco.current_cafe.name,
					menu_id: '1',
					dayparts: [dayparts],
				},
			},
		],
	})
}

/// The campus dates of `count` days, starting with `today` (`YYYY-MM-DD`).
export function menuDates(today: string, count: number): string[] {
	return Array.from({length: count}, (_, offset) => {
		let date = new Date(`${today}T00:00:00Z`)
		date.setUTCDate(date.getUTCDate() + offset)
		return date.toISOString().slice(0, 10)
	})
}

/// A café page's address for one date: BonApp serves a day's menu at the
/// café's path with the date appended, replacing any date already there.
export function cafeUrlForDate(cafeUrl: string | URL, date: string): string {
	let url = new URL(cafeUrl)
	if (url.protocol === 'data:') return url.toString()
	url.pathname = `${url.pathname.replace(/\/\d{4}-\d{2}-\d{2}\/?$/, '').replace(/\/$/, '')}/${date}/`
	return url.toString()
}

/// How a promise ended, in the shape `Promise.allSettled` reports.
export type Settled<T> = {status: 'fulfilled'; value: T} | {status: 'rejected'; reason: unknown}

/// A promise's outcome as `Promise.allSettled` reports it, for one promise.
export function settled<T>(promise: Promise<T>): Promise<Settled<T>> {
	return promise.then(
		(value) => ({status: 'fulfilled' as const, value}),
		(reason: unknown) => ({status: 'rejected' as const, reason}),
	)
}

/// One café page's load for a date, as `Promise.allSettled` reports it.
export interface DatedPage {
	date: string
	page: Settled<BamcoPageContents | null>
}

/// The menu for one or more days' pages, in the order given. A day whose page
/// could not be loaded becomes an error stand-in for that day alone, so one bad
/// page from BonApp does not cost the others; when no page loaded, the first
/// failure is thrown, so the caller answers as it would for a single page.
export function menuFromPages(pages: DatedPage[]): CafeMenuResponseType {
	let failure = pages.find((p) => p.page.status === 'rejected')?.page
	if (failure?.status === 'rejected' && pages.every((p) => p.page.status === 'rejected')) {
		throw failure.reason
	}

	// across several days, each day's stand-in item is named for its day, so a
	// closed day and a failed day do not overwrite each other's item `1`
	let standInId = (kind: string, date: string) => (pages.length > 1 ? `${kind}-${date}` : '1')
	let menus = pages.map(({date, page}) => {
		if (page.status === 'rejected') {
			return CafeMenuWithError(
				page.reason instanceof Error ? page.reason.message : String(page.reason),
				'Could not load the BonApp menu data',
				date,
				standInId('error', date),
			)
		}
		return page.value === null
			? CafeMenuIsClosed(date, standInId('closed', date))
			: menuFrom(page.value, date)
	})
	// each day's icons are kept, in case a day's page lists only those its items use
	return menus.reduce<CafeMenuResponseType>(
		(combined, menu) => ({
			cor_icons: {...combined.cor_icons, ...menu.cor_icons},
			items: {...combined.items, ...menu.items},
			days: [...combined.days, ...menu.days],
		}),
		{cor_icons: {}, items: {}, days: []},
	)
}
