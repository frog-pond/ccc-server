import {getJson} from '../../ccc-lib/http.ts'
import {ONE_DAY} from '../../ccc-lib/constants.ts'
import {GH_PAGES} from './gh-pages.ts'
import type {Context} from '../../ccc-server/context.ts'

/// The small data files AAO-React-Native publishes from its `data/` folder.
/// The app asks for them here, rather than on GitHub Pages directly, so that
/// where they are published can change without an app release.
///
/// `GH_PAGES` is a function of the file name, so each route names its file
/// outright: a request never chooses which file is fetched.
function pagesJson(filename: string) {
	return async (ctx: Context) => {
		ctx.cacheControl(ONE_DAY)
		if (ctx.cached(ONE_DAY)) return

		ctx.body = await getJson(GH_PAGES(filename))
	}
}

/// Links the A–Z index shows beyond the ones St. Olaf publishes itself.
export const aToZExtras = pagesJson('a-to-z.json')

/// The icon and gradient the app draws for each student org category.
export const orgCategoryStyles = pagesJson('org-categories.json')

/// The groups the campus map's building list is sorted into.
export const mapCategories = pagesJson('map-categories.json')

/// The Student Work areas, and the units each one collects.
export const studentWorkAreas = pagesJson('student-work-areas.json')

/// The Student Work pay rates.
export const studentWorkWages = pagesJson('student-wages.json')
