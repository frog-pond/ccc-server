import {get} from '../ccc-lib/http.js'
import {JSDOM} from 'jsdom'
import {groupBy} from 'lodash-es'
import {z} from 'zod'

export type NnbResponseType = z.infer<typeof NnbResponseSchema>
export const NnbResponseSchema = z.array(
	z.object({
		title: z.string(),
		data: z.array(
			z.object({
				description: z.string(),
				category: z.string(),
			}),
		),
	}),
)

export async function noonNewsBulletin(): Promise<NnbResponseType> {
	let body = await get('https://apps.carleton.edu/campact/nnb/show.php3', {
		searchParams: {style: 'rss'},
	}).text()
	let dom = new JSDOM(body, {contentType: 'text/xml'})

	let bulletinEls = [...dom.window.document.querySelectorAll('item')]
	let bulletins = bulletinEls.map((item) => {
		let description = item.querySelector('description')?.textContent ?? ''
		description = JSDOM.fragment(description).textContent?.trim() ?? ''
		let category = item.querySelector('category')?.textContent ?? ''
		category = JSDOM.fragment(category).textContent?.trim() ?? ''
		return {description, category}
	})

	const grouped = groupBy(bulletins, (m) => m.category)
	return NnbResponseSchema.parse(Object.entries(grouped).map(([key, value]) => ({title: key, data: value})))
}
