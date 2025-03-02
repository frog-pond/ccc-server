import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import mem from 'memoize'
import {GH_PAGES} from './gh-pages.js'
import type {Context} from '../../ccc-server/context.js'
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

const getOlafAtoZ = mem(
	async () => {
		let url = 'https://wp.stolaf.edu/wp-json/site-data/sidebar/a-z'
		const response = await get(url)
		return StOlafAzResponseSchema.parse(await response.clone().json())
	},
	{maxAge: ONE_DAY},
)

const getPagesAtoZ = mem(
	async () => {
		const response = await get(GH_PAGES('a-to-z.json'))
		return AllAboutOlafExtraAzResponseSchema.parse(await response.clone().json())
	},
	{maxAge: ONE_DAY},
)

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

	let pagesResponse = await getPagesAtoZ()
	let olafResponse = await getOlafAtoZ()

	ctx.body = combineResponses(pagesResponse, olafResponse)
}
