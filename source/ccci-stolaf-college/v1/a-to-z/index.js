import {get, ONE_DAY} from '../../../ccc-lib/index.js'
import mem from 'memoize'
import {GH_PAGES} from '../gh-pages.js'

const GET = mem(get, {maxAge: ONE_DAY})

function getOlafAtoZ() {
	let url = 'https://wp.stolaf.edu/wp-json/site-data/sidebar/a-z'
	return GET(url).json()
}

function getPagesAtoZ() {
	return GET(GH_PAGES('a-to-z.json')).json()
}

// merge custom entries defined on GH pages with the fetched WP-JSON
function combineResponses(pagesResponse, olafResponse) {
	let olafData = olafResponse.az_nav.menu_items

	pagesResponse.data.forEach(({letter, values}) => {
		// find the matching keyed letter to add our own values to
		let targetIndex = olafData.findIndex((entry) => entry.letter === letter)

		if (targetIndex in olafData) {
			// add our custom values and only resort the impacted indices
			olafData[targetIndex].values.push(...values)
			olafData[targetIndex].values.sort((a, b) =>
				a.label.localeCompare(b.label),
			)
		}
	})

	return olafData.map(({letter, values}) => ({
		title: letter[0],
		data: values,
	}))
}

export async function atoz(ctx) {
	ctx.cacheControl(ONE_DAY)

	let pagesResponse = await getPagesAtoZ()
	let olafResponse = await getOlafAtoZ()

	ctx.body = combineResponses(pagesResponse, olafResponse)
}
