/* eslint-disable camelcase */

import {get} from '../ccc-lib/http.js'
import {JSDOM, VirtualConsole} from 'jsdom'
import {z} from 'zod'
import * as Sentry from '@sentry/node'

function getBonAppWebpage(url) {
	const virtualConsole = new VirtualConsole()
	virtualConsole.sendTo(console, {omitJSDOMErrors: true})
	virtualConsole.on('jsdomError', (err) => {
		let messagesToSkip = [
			'Uncaught [ReferenceError: wp is not defined]',
			'Uncaught [ReferenceError: jQuery is not defined]',
		]
		if (messagesToSkip.includes(err.message)) {
			return
		}
		console.error(err)
	})
	return JSDOM.fromURL(url, {
		runScripts: 'dangerously',
		virtualConsole,
	})
}

const zodYesNo = z.union([z.literal('Y'), z.literal('N')])
const zodNumericString = z.string().regex(/d*/)
const zodCurrencyString = z.string() //.regex(/^\$.*/)
const zodHtmlString = z.string()
const zod24Time = z.string().regex(/\d\d:\d\d/)
const zodNumericBoolean = z.number().gte(0).lte(1)

const MonotonyContainer = z.object({
	id: z.string(),
	name: z.string(),
	short_name: z.optional(z.null()),
	image: z.string(),
})

const NutritionContainer = z.object({
	kcal: zodNumericString,
	well_being: z.string(),
	well_being_image: z.string(),
})

const NutritionDetailType = z.object({
	label: z.string(),
	value: z.string(),
	unit: z.string(),
})

const NutritionDetailContainer = z.object({
	calories: z.optional(NutritionDetailType),
	servingSize: z.optional(NutritionDetailType),
	fatContent: z.optional(NutritionDetailType),
	saturatedFatContent: z.optional(NutritionDetailType),
	transFatContent: z.optional(NutritionDetailType),
	cholesterolContent: z.optional(NutritionDetailType),
	sodiumContent: z.optional(NutritionDetailType),
	carbohydrateContent: z.optional(NutritionDetailType),
	fiberContent: z.optional(NutritionDetailType),
	sugarContent: z.optional(NutritionDetailType),
	proteinContent: z.optional(NutritionDetailType),
})

const CafeMenuItem = z.object({
	connector: z.string(),
	cor_icon: z.union([z.array(z.unknown()), z.record(z.string())]),
	description: z.string(),
	id: z.unknown(),
	label: z.string(),
	monotony: z.union([z.object({}), MonotonyContainer]),
	nutrition: NutritionContainer,
	nutrition_details: z.optional(NutritionDetailContainer),
	nutrition_link: z.string(),
	options: z.union([z.array(z.unknown()), z.record(z.unknown())]),
	price: zodCurrencyString,
	rating: zodNumericString,
	special: zodNumericBoolean,
	station: zodHtmlString,
	sub_station: z.string(),
	sub_station_id: zodNumericString,
	sub_station_order: zodNumericString,
	zero_entree: zodNumericString,
})

const BamcoStation = z.object({
	order_id: z.string(), // sort on order_id instead of sorting on id
	id: zodNumericString,
	label: z.string(),
	price: zodCurrencyString,
	note: z.string(),
	soup: z.unknown(),
	items: z.array(z.string()),
})

const BamcoDayPart = z.object({
	abbreviation: z.string(),
	endtime: zod24Time,
	endtime_formatted: z.string(),
	id: z.unknown(),
	label: z.string(),
	message: z.union([z.literal(''), z.string()]),
	starttime: zod24Time,
	starttime_formatted: z.string(),
	time_formatted: z.string(),
	stations: z.array(BamcoStation),
})

const CafeInfo = z.object({
	name: z.string(),
	address: z.string(),
	city: z.string(),
	state: z.string(),
	zip: z.string(),
	latitude: z.string(),
	longitude: z.string(),
	description: z.string(),
	message: z.string(),
	eod: z.string(),
	timezone: z.string(),
	menu_type: z.string(),
	menu_html: z.string(),
	weekly_schedule: z.string(),
	days: z.array(
		z.object({
			date: z.string().date(),
			status: z.union([z.literal('open'), z.literal('closed'), z.string()]),
			message: z.union([z.literal(false), z.string()]),
			dayparts: z.array(
				BamcoDayPart.pick({
					id: true,
					starttime: true,
					endtime: true,
					message: true,
					label: true,
				}),
			),
		}),
	),
})

const BamcoCafeInfo = z.object({
	cafe: CafeInfo,
})

const BamcoCorIcon = z.object({
	allergen: z.unknown(),
	description: z.string(),
	id: z.unknown(),
	image: z.string().url(),
	is_filter: zodYesNo,
	label: z.string(),
	position: zodNumericString,
	show_name_ds: zodYesNo,
	slug: z.string(),
	sort: zodNumericString,
	type: z.string(),
})

const BamcoPageContents = z.union([
	z.undefined(),
	z.object({
		current_cafe: z.object({
			name: z.string(),
			id: z.unknown(),
		}),
		menu_items: z.record(CafeMenuItem),
		cor_icons: z.union([z.array(z.unknown()), z.record(BamcoCorIcon)]),
		dayparts: z.record(BamcoDayPart),
	}),
])

function CustomCafe({message}) {
	let today = new Date()
	return BamcoCafeInfo.parse({
		cafe: {
			name: 'Café',
			address: '',
			city: '',
			state: '',
			zip: '',
			latitude: '',
			longitude: '',
			description: '',
			message,
			eod: '',
			timezone: '',
			menu_type: '',
			menu_html: '',
			weekly_schedule: '',
			days: [
				{
					date: today.toISOString().split('T')[0],
					status: 'Message',
					message,
					dayparts: [],
				},
			],
		},
	})
}

/**
 * @param {string|URL} cafeUrl
 * @returns {Promise<BamcoCafeInfo>}
 */
export async function cafe(cafeUrl) {
	let today = new Date()
	let dom = await getBonAppWebpage(cafeUrl)

	let bamco = BamcoPageContents.safeParse(dom.window.Bamco)
	if (!bamco.success) {
		console.error(bamco.error)
		Sentry.isInitialized() && Sentry.captureException(bamco.error)
		return CustomCafe({message: 'Could not load the BonApp menu data'})
	}

	if (typeof bamco.data === 'undefined') {
		return CustomCafe({message: 'Café is closed'})
	}

	let response = BamcoCafeInfo.safeParse({
		cafe: {
			name: bamco.data.current_cafe.name,
			address: '',
			city: '',
			state: '',
			zip: '',
			latitude: '',
			longitude: '',
			description: '',
			message: '',
			eod: '',
			timezone: '',
			menu_type: '',
			menu_html: '',
			weekly_schedule: '',
			days: [
				{
					date: today.toISOString().split('T')[0],
					status: '',
					message: false,
					dayparts: Object.values(bamco.data.dayparts).map(
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

	if (!response.success) {
		console.error(response.error)
		Sentry.isInitialized() && Sentry.captureException(bamco.error)
		return CustomCafe({message: 'Could not transform the BonApp menu data'})
	}

	return response.data
}

export function nutrition(itemId) {
	let url = 'https://legacy.cafebonappetit.com/api/2/items'
	return get(url, {searchParams: {item: itemId}}).json()
}

const StationMenuType = z.object({
	order_id: z.string(), // sort on order_id instead of sorting on id
	id: zodNumericString,
	label: z.string(),
	price: zodCurrencyString,
	note: z.string(),
	items: z.array(z.string()),
})

const DayPartMenuType = z.object({
	starttime: zod24Time,
	endtime: zod24Time,
	id: zodNumericString,
	label: z.string(),
	abbreviation: z.string(),
	stations: z.array(StationMenuType),
})

const DayPartsCollectionType = z.array(z.array(DayPartMenuType))

const CafeMenuType = z.object({
	name: z.string(),
	menu_id: zodNumericString,
	dayparts: DayPartsCollectionType,
})

const CafeMenuForDay = z.object({
	date: z.string().date(),
	cafe: CafeMenuType,
})

const CafeMenu = z.object({
	cor_icons: z.record(BamcoCorIcon),
	days: z.array(CafeMenuForDay),
	items: z.record(CafeMenuItem),
})

function CustomCafeMenuItem({station, sub_station, description, label}) {
	return CafeMenuItem.parse({
		connector: '',
		cor_icon: {},
		description,
		id: '1',
		label,
		monotony: {},
		nutrition: {kcal: '', well_being: '', well_being_image: ''},
		nutrition_link: '',
		options: {},
		price: '',
		rating: '5',
		special: 1,
		station,
		sub_station,
		sub_station_id: '1',
		sub_station_order: '1-1',
		zero_entree: '0',
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

function CafeMenuWithError(error, label) {
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

function CafeMenuIsClosed() {
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

export async function menu(cafeUrl) {
	let today = new Date()
	let dom = await getBonAppWebpage(cafeUrl)

	let bamco = BamcoPageContents.safeParse(dom.window.Bamco)
	if (!bamco.success) {
		console.error(bamco.error)
		Sentry.isInitialized() && Sentry.captureException(bamco.error)
		return CustomCafe({message: 'Could not load the BonApp menu data'})
	}

	if (typeof bamco.data === 'undefined') {
		return CafeMenuIsClosed()
	}

	let response = CafeMenu.safeParse({
		cor_icons: Array.isArray(bamco.data.cor_icons) ? {} : bamco.data.cor_icons,
		items: bamco.data.menu_items,
		days: [
			{
				date: today.toISOString().split('T')[0],
				cafe: {
					name: bamco.data.current_cafe.name,
					menu_id: '1',
					dayparts: [Object.values(bamco.data.dayparts)],
				},
			},
		],
	})

	if (!response.success) {
		console.error(response.error)
		Sentry.isInitialized() && Sentry.captureException(bamco.error)
		return CafeMenuWithError(
			response.error.message,
			'Could not transform the BonApp menu data',
		)
	}

	return response.data
}