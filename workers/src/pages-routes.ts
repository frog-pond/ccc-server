export type PagesRoute = {
	/// the url the data is published at
	url: string
}

// where each college publishes its data files
const STOLAF = (file: string) => `https://stolaf.dev/AAO-React-Native/${file}`
const STOLAF_MAP = (file: string) => `https://stolaf.dev/campus-map-data/${file}`
const CARLETON = (file: string) => `https://carls-app.github.io/carls/${file}`
const CARLETON_MAP = (file: string) => `https://carls-app.github.io/map-data/${file}`

/// What St. Olaf serves from its published data files, by path.
export const STOLAF_FILES: Record<string, PagesRoute> = {
	'/contacts': {url: STOLAF('contact-info.json')},
	'/dictionary': {url: STOLAF('dictionary.json')},
	'/faqs': {url: STOLAF('faqs.json')},
	'/tools/help': {url: STOLAF('help.json')},
	'/webcams': {url: STOLAF('webcams.json')},
	'/spaces/hours': {url: STOLAF('building-hours.json')},
	'/spaces/directory': {url: STOLAF('building-directory.json')},
	'/sources': {url: STOLAF('sources.json')},
	'/a-to-z/extras': {url: STOLAF('a-to-z.json')},
	'/orgs/category-styles': {url: STOLAF('org-categories.json')},
	'/map': {url: STOLAF_MAP('map.json')},
	'/map/geojson': {url: STOLAF_MAP('map.geojson')},
	'/map/categories': {url: STOLAF('map-categories.json')},
	'/map/style': {url: STOLAF_MAP('style.json')},
	'/map/style-dark': {url: STOLAF_MAP('style-dark.json')},
	'/student-work/areas': {url: STOLAF('student-work-areas.json')},
	'/student-work/wages': {url: STOLAF('student-wages.json')},
}

/// What Carleton serves from its published data files, by path.
export const CARLETON_FILES: Record<string, PagesRoute> = {
	'/contacts': {url: CARLETON('contact-info.json')},
	'/dictionary': {url: CARLETON('dictionary-carls.json')},
	'/faqs': {url: CARLETON('faqs.json')},
	'/tools/help': {url: CARLETON('help.json')},
	'/webcams': {url: CARLETON('webcams.json')},
	'/spaces/hours': {url: CARLETON('building-hours.json')},
	'/map': {url: CARLETON_MAP('map.json')},
	'/map/geojson': {url: CARLETON_MAP('map.geojson')},
}
