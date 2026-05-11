import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'
import {z} from 'zod'

const STOLAF_BASE_URL = 'https://stolaf.edu'
const AzValueSchema = z.object({label: z.string(), url: z.string().url()})
const AzValueStructureSchema = z.object({label: z.string(), url: z.string()})

type StOlafAzResponseType = z.infer<typeof StOlafAzResponseSchema>
const StOlafAzResponseStructureSchema = z.object({
	az_nav: z.object({
		menu_items: z.array(
			z.object({
				letter: z.string(),
				values: z.array(AzValueStructureSchema),
			}),
		),
	}),
})
const StOlafAzResponseSchema = z.object({
	az_nav: z.object({
		menu_items: z.array(
			z.object({
				letter: z.string(),
				values: z.array(AzValueSchema),
			}),
		),
	}),
})

type AllAboutOlafExtraAzResponseType = z.infer<typeof AllAboutOlafExtraAzResponseSchema>
const AllAboutOlafExtraAzResponseStructureSchema = z.object({
	data: z.array(
		z.object({
			letter: z.string(),
			values: z.array(AzValueStructureSchema),
		}),
	),
})
const AllAboutOlafExtraAzResponseSchema = z.object({
	data: z.array(
		z.object({
			letter: z.string(),
			values: z.array(AzValueSchema),
		}),
	),
})

export function normalizeAndValidateAzValues(values: z.infer<typeof AzValueStructureSchema>[]) {
	return values.flatMap(({label, url}) => {
		let formattedLabel = label.trim()
		let formattedUrl = url.trim()

		if (!formattedLabel && !formattedUrl) return []
		if (formattedUrl.startsWith('/')) formattedUrl = `${STOLAF_BASE_URL}${formattedUrl}`

		const parsed = AzValueSchema.safeParse({label: formattedLabel, url: formattedUrl})
		return parsed.success ? [parsed.data] : []
	})
}

const getOlafAtoZ = async () => {
	const response = await getJson('https://wp.stolaf.edu/wp-json/site-data/sidebar/a-z')
	const structure = StOlafAzResponseStructureSchema.parse(await response)
	return StOlafAzResponseSchema.parse({
		az_nav: {
			menu_items: structure.az_nav.menu_items.map(({letter, values}) => ({
				letter,
				values: normalizeAndValidateAzValues(values),
			})),
		},
	})
}

const getPagesAtoZ = async () => {
	const response = await getJson(GH_PAGES('a-to-z.json'))
	const structure = AllAboutOlafExtraAzResponseStructureSchema.parse(await response)
	return AllAboutOlafExtraAzResponseSchema.parse({
		data: structure.data.map(({letter, values}) => ({
			letter,
			values: normalizeAndValidateAzValues(values),
		})),
	})
}

// merge custom entries defined on GH pages with the fetched WP-JSON
function combineResponses(
	pagesResponse: AllAboutOlafExtraAzResponseType,
	olafResponse: StOlafAzResponseType,
) {
	let olafData = olafResponse.az_nav.menu_items

	pagesResponse.data.forEach(({letter, values}) => {
		// find the matching keyed letter to add our own values to
		let targetIndex = olafData.findIndex((entry) => entry.letter === letter)
		let targetData = olafData[targetIndex]

		if (targetData) {
			// add our custom values and only resort the impacted indices
			targetData.values.push(...values)
			targetData.values.sort((a, b) => a.label.localeCompare(b.label))
		}
	})

	return olafData.map(({letter, values}) => ({
		title: letter[0],
		data: values,
	}))
}

export async function atoz(ctx: Context) {
	ctx.cacheControl(ONE_DAY)
	if (ctx.cached(ONE_DAY)) return

	let pagesResponse = await getPagesAtoZ()
	let olafResponse = await getOlafAtoZ()

	ctx.body = combineResponses(pagesResponse, olafResponse)
}
