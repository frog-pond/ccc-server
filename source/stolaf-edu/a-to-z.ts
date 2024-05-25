import {z} from 'zod'
import {get} from '../ccc-lib/http.js'
import {type AllAboutOlafExtraAzResponseType} from '../ccc-frog-pond/a-to-z.js'

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

export const AToZResponseSchema = z.array(
	z.object({
		title: z.string(),
		data: z
			.object({
				url: z.string().url(),
				label: z.string(),
			})
			.array(),
	}),
)

export async function getOlafAtoZ() {
	let url = 'https://wp.stolaf.edu/wp-json/site-data/sidebar/a-z'
	return StOlafAzResponseSchema.parse(await get(url).json())
}

// merge custom entries defined on GH pages with the fetched WP-JSON
export async function combineResponses(
	pages: Promise<AllAboutOlafExtraAzResponseType>,
	stolaf: Promise<StOlafAzResponseType>,
) {
	let pagesResponse = await pages
	let olafResponse = await stolaf

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
