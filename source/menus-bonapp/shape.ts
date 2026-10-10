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
	station,
	sub_station,
	description,
	label,
}: {
	station: string
	sub_station: string
	description: string
	label: string
}) {
	return CafeMenuItemSchema.parse({
		description,
		id: '1',
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

export function CafeMenuIsClosed(date: string) {
	return CafeMenuResponseSchema.parse({
		cor_icons: {},
		items: {
			1: CustomCafeMenuItem({
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
	abbreviation,
	label,
	message,
	note,
}: {
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
				items: ['1'],
				soup: null,
			},
		],
	})
}

export function CafeMenuWithError(error: unknown, label: string, date: string) {
	return CafeMenuResponseSchema.parse({
		cor_icons: {},
		items: {
			1: CustomCafeMenuItem({
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
