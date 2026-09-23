import moment from 'moment-timezone'
import {
	CafeInfoResponseSchema,
	CafeMenuDayPartSchema,
	CafeMenuResponseSchema,
	CafeMenuItemSchema,
} from './types.ts'

/**
 * The zone both colleges keep time in. BonApp's cafe pages show the day it is
 * on campus, so the day a response is dated has to be read on the same clock.
 */
const CAMPUS_TIMEZONE = 'America/Chicago'

/**
 * Today's date on campus, e.g. `2026-09-22`.
 *
 * Not the UTC date: from 7 PM (6 PM in winter) until midnight, UTC is already
 * on the next day, and a response dated by it claims tomorrow for the dayparts
 * BonApp is showing for today.
 */
export function campusToday(now: Date = new Date()): string {
	return moment(now).tz(CAMPUS_TIMEZONE).format('YYYY-MM-DD')
}

export function CustomCafe(message: string) {
	return CafeInfoResponseSchema.parse({
		cafe: {
			name: 'Café',
			message,
			days: [
				{
					date: campusToday(),
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
		sub_station_order: '1-1',
		zero_entree: '0',
	})
}

export function CafeMenuIsClosed() {
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
				date: campusToday(),
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

export function CafeMenuWithError(error: unknown, label: string) {
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
				date: campusToday(),
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
