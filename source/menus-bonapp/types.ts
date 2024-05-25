import {z} from 'zod'

const zodYesNo = z.union([z.literal('Y'), z.literal('N')])
const zodNumericString = z.string().regex(/d*/)
const zodCurrencyString = z.string() //.regex(/^\$.*/)
const zodHtmlString = z.string()
const zod24Time = z.string().regex(/\d\d:\d\d/)
const zodNumericBoolean = z.number().gte(0).lte(1)

// ===--- Cafe Information ---=== //

export type CafeInfoDayPartType = z.infer<typeof CafeInfoDayPartSchema>
export const CafeInfoDayPartSchema = z.object({
	id: z.unknown(),
	endtime: zod24Time,
	starttime: zod24Time,
	label: z.string(),
	message: z.union([z.literal(''), z.string(), z.null()]),
})

const CafeInfoSchema = z.object({
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
			status: z.union([z.literal('open'), z.literal('closed'), z.string()]).default(''),
			message: z.union([z.literal(false), z.string()]).default(false),
			dayparts: z.array(CafeInfoDayPartSchema),
		}),
	),
})

export type CafeInfoResponseType = z.infer<typeof CafeInfoResponseSchema>
export const CafeInfoResponseSchema = z.object({
	cafe: CafeInfoSchema,
})

// ===--- Cafe Menus ---=== //

const CafeMenuItemMonotonySchema = z
	.object({
		id: z.string(),
		name: z.string(),
		short_name: z.optional(z.null()),
		image: z.string(),
	})
	.or(z.object({}))

const CafeMenuItemNutritionSchema = z
	.object({
		kcal: zodNumericString.default(''),
		well_being: z.string().default(''),
		well_being_image: z.string().default(''),
	})
	.default({kcal: '', well_being: '', well_being_image: ''})

const CafeMenuItemNutritionDetailSchema = z.object({
	label: z.string(),
	value: z.string(),
	unit: z.string(),
})

const CafeMenuItemNutritionDetailContainerSchema = z.object({
	calories: z.optional(CafeMenuItemNutritionDetailSchema),
	servingSize: z.optional(CafeMenuItemNutritionDetailSchema),
	fatContent: z.optional(CafeMenuItemNutritionDetailSchema),
	saturatedFatContent: z.optional(CafeMenuItemNutritionDetailSchema),
	transFatContent: z.optional(CafeMenuItemNutritionDetailSchema),
	cholesterolContent: z.optional(CafeMenuItemNutritionDetailSchema),
	sodiumContent: z.optional(CafeMenuItemNutritionDetailSchema),
	carbohydrateContent: z.optional(CafeMenuItemNutritionDetailSchema),
	fiberContent: z.optional(CafeMenuItemNutritionDetailSchema),
	sugarContent: z.optional(CafeMenuItemNutritionDetailSchema),
	proteinContent: z.optional(CafeMenuItemNutritionDetailSchema),
})

export type CafeMenuItemType = z.infer<typeof CafeMenuItemSchema>
export const CafeMenuItemSchema = z.object({
	connector: z.string().default(''),
	cor_icon: z.union([z.array(z.unknown()), z.record(z.string())]).default({}),
	description: z.string(),
	id: z.unknown(),
	label: z.string(),
	monotony: CafeMenuItemMonotonySchema.default({}),
	nutrition: CafeMenuItemNutritionSchema,
	nutrition_details: z.optional(CafeMenuItemNutritionDetailContainerSchema),
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

const CafeMenuStationSchema = z.object({
	order_id: z.string(), // sort on order_id instead of sorting on id
	id: zodNumericString,
	label: z.string(),
	price: zodCurrencyString,
	note: z.string(),
	soup: z.unknown().optional(),
	items: z.array(z.string()),
})

export type CafeMenuDayPartType = z.infer<typeof CafeMenuDayPartSchema>
export const CafeMenuDayPartSchema = z.object({
	abbreviation: z.string(),
	endtime: zod24Time,
	endtime_formatted: z.string(),
	id: z.unknown(),
	label: z.string(),
	message: z.union([z.literal(''), z.string(), z.null()]),
	starttime: zod24Time,
	starttime_formatted: z.string(),
	time_formatted: z.string(),
	stations: z.array(CafeMenuStationSchema),
})

const CafeMenuSchema = z.object({
	name: z.string(),
	menu_id: zodNumericString,
	dayparts: z.array(z.array(CafeMenuDayPartSchema)),
})

const CorIconSchema = z.object({
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

export type CafeMenuResponseType = z.infer<typeof CafeMenuResponseSchema>
export const CafeMenuResponseSchema = z.object({
	cor_icons: z.record(CorIconSchema),
	days: z.array(z.object({date: z.string().date(), cafe: CafeMenuSchema})),
	items: z.record(CafeMenuItemSchema),
})
