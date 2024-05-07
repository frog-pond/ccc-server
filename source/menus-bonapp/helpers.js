import {BamcoCafeInfo, BamcoDayPart, CafeMenu, CafeMenuItem} from './types.js'

/** @returns {BamcoCafeInfo} */
export function CustomCafe({message}) {
	let today = new Date()
	return BamcoCafeInfo.parse({
		cafe: {
			name: 'Café',
			message,
			days: [
				{
					date: today.toISOString().split('T')[0],
					dayparts: [],
					message,
				},
			],
		},
	})
}

function CustomCafeMenuItem({station, sub_station, description, label}) {
	return CafeMenuItem.parse({
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

/** @returns {CafeMenu} */
export function CafeMenuIsClosed() {
	let today = new Date()
	return CafeMenu.parse({
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
				date: today.toISOString().split('T')[0],
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

function CustomCafeDayPart({abbreviation, label, message, note}) {
	return BamcoDayPart.parse({
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

export function CafeMenuWithError(error, label) {
	let today = new Date()
	return CafeMenu.parse({
		cor_icons: {},
		items: {
			1: CustomCafeMenuItem({
				description: `Please email allaboutolaf@frogpond.tech: ${error}`,
				label: label,
				station: 'error!?‽',
				sub_station: 'error…',
			}),
		},
		days: [
			{
				date: today.toISOString().split('T')[0],
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
