import {z} from 'zod'

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

const NutritionContainer = z
	.object({
		kcal: zodNumericString.default(''),
		well_being: z.string().default(''),
		well_being_image: z.string().default(''),
	})
	.default({kcal: '', well_being: '', well_being_image: ''})

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

export const CafeMenuItem = z.object({
	connector: z.string().default(''),
	cor_icon: z.union([z.array(z.unknown()), z.record(z.string())]).default({}),
	description: z.string(),
	id: z.unknown(),
	label: z.string(),
	monotony: z.union([z.object({}), MonotonyContainer]).default({}),
	nutrition: NutritionContainer,
	nutrition_details: z.optional(NutritionDetailContainer),
	nutrition_link: z.string().default(''),
	options: z.union([z.array(z.unknown()), z.record(z.unknown())]).default({}),
	price: zodCurrencyString.default(''),
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

export const BamcoDayPart = z.object({
	abbreviation: z.string(),
	endtime: zod24Time,
	endtime_formatted: z.string(),
	id: z.unknown(),
	label: z.string(),
	message: z.union([z.literal(''), z.string(), z.null()]),
	starttime: zod24Time,
	starttime_formatted: z.string(),
	time_formatted: z.string(),
	stations: z.array(BamcoStation),
})

const CafeInfo = z.object({
	name: z.string(),
	address: z.string().default(''),
	city: z.string().default(''),
	state: z.string().default(''),
	zip: z.string().default(''),
	latitude: z.string().default(''),
	longitude: z.string().default(''),
	description: z.string().default(''),
	message: z.string().default(''),
	eod: z.string().default(''),
	timezone: z.string().default(''),
	menu_type: z.string().default(''),
	menu_html: z.string().default(''),
	weekly_schedule: z.string().default(''),
	days: z.array(
		z.object({
			date: z.string().date(),
			status: z
				.union([z.literal('open'), z.literal('closed'), z.string()])
				.default(''),
			message: z.union([z.literal(false), z.string()]).default(false),
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

export const BamcoPageContents = z.union([
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

export const BamcoCafeInfo = z.object({
	cafe: CafeInfo,
})

export const CafeMenu = z.object({
	cor_icons: z.record(BamcoCorIcon),
	days: z.array(CafeMenuForDay),
	items: z.record(CafeMenuItem),
})
