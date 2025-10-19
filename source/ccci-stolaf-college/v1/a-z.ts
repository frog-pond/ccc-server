import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'
import {z} from 'zod'

type StOlafAzResponseType = z.infer<typeof StOlafAzResponseSchema>
const StOlafAzResponseSchema = z.object({
	az_nav: z.object({
		menu_items: z.array(
			z.object({
				letter: z.string(),
				values: z.array(z.object({label: z.string(), url: z.string().url()})),
			}),
		),
	}),
})

type AllAboutOlafExtraAzResponseType = z.infer<typeof AllAboutOlafExtraAzResponseSchema>
const AllAboutOlafExtraAzResponseSchema = z.object({
	data: z.array(
		z.object({
			letter: z.string(),
			values: z.array(z.object({label: z.string(), url: z.string().url()})),
		}),
	),
})

const getOlafAtoZ = async () => {
	const response = await getJson('https://wp.stolaf.edu/wp-json/site-data/sidebar/a-z')
	return StOlafAzResponseSchema.parse(await response)
}

const getPagesAtoZ = async () => {
	const response = await getJson(GH_PAGES('a-to-z.json'))
	return AllAboutOlafExtraAzResponseSchema.parse(await response)
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
