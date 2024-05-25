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

const BamcoMenuItemSchema = z.object({
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

const BamcoStationSchema = z.object({
	order_id: z.string(), // sort on order_id instead of sorting on id
	id: zodNumericString,
	label: z.string(),
	price: zodCurrencyString,
	note: z.string(),
	soup: z.unknown(),
	items: z.array(z.string()),
})

const BamcoDayPartSchema = z.object({
	abbreviation: z.string(),
	endtime: zod24Time,
	endtime_formatted: z.string(),
	id: z.unknown(),
	label: z.string(),
	message: z.union([z.literal(''), z.string(), z.null()]),
	starttime: zod24Time,
	starttime_formatted: z.string(),
	time_formatted: z.string(),
	stations: z.array(BamcoStationSchema),
})

const BamcoCorIconSchema = z.object({
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

export const BamcoPageContentsSchema = z.union([
	z.undefined(),
	z.object({
		current_cafe: z.object({
			name: z.string(),
			id: z.unknown(),
		}),
		menu_items: z.record(BamcoMenuItemSchema),
		cor_icons: z.union([z.array(z.unknown()), z.record(BamcoCorIconSchema)]),
		dayparts: z.record(BamcoDayPartSchema),
	}),
])
