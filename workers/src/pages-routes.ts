const HOUR = 60 * 60
const DAY = 24 * HOUR

export type PagesRoute = {
	/// the url the data is published at
	url: string
	/// how long the apps are told to keep it, as the Node server's route did
	maxAge: number
}

// where each college publishes its data files
const STOLAF = (file: string) => `https://stolaf.dev/AAO-React-Native/${file}`
const STOLAF_MAP = (file: string) => `https://stolaf.dev/campus-map-data/${file}`
const CARLETON = (file: string) => `https://carls-app.github.io/carls/${file}`
const CARLETON_MAP = (file: string) => `https://carls-app.github.io/map-data/${file}`

/// What St. Olaf serves from its published data files, by path.
export const STOLAF_FILES: Record<string, PagesRoute> = {
	'/contacts': {url: STOLAF('contact-info.json'), maxAge: DAY},
	'/dictionary': {url: STOLAF('dictionary.json'), maxAge: DAY},
	'/faqs': {url: STOLAF('faqs.json'), maxAge: DAY},
	'/tools/help': {url: STOLAF('help.json'), maxAge: DAY},
	'/webcams': {url: STOLAF('webcams.json'), maxAge: DAY},
	'/spaces/hours': {url: STOLAF('building-hours.json'), maxAge: HOUR},
	'/spaces/directory': {url: STOLAF('building-directory.json'), maxAge: HOUR},
	'/sources': {url: STOLAF('sources.json'), maxAge: DAY},
	'/a-to-z/extras': {url: STOLAF('a-to-z.json'), maxAge: DAY},
	'/orgs/category-styles': {url: STOLAF('org-categories.json'), maxAge: DAY},
	'/map': {url: STOLAF_MAP('map.json'), maxAge: HOUR},
	'/map/geojson': {url: STOLAF_MAP('map.geojson'), maxAge: HOUR},
	'/map/categories': {url: STOLAF('map-categories.json'), maxAge: DAY},
	'/map/style': {url: STOLAF_MAP('style.json'), maxAge: HOUR},
	'/map/style-dark': {url: STOLAF_MAP('style-dark.json'), maxAge: HOUR},
	'/student-work/areas': {url: STOLAF('student-work-areas.json'), maxAge: DAY},
	'/student-work/wages': {url: STOLAF('student-wages.json'), maxAge: DAY},
}

/// What Carleton serves from its published data files, by path.
export const CARLETON_FILES: Record<string, PagesRoute> = {
	'/contacts': {url: CARLETON('contact-info.json'), maxAge: HOUR},
	'/dictionary': {url: CARLETON('dictionary-carls.json'), maxAge: HOUR},
	'/faqs': {url: CARLETON('faqs.json'), maxAge: HOUR},
	'/tools/help': {url: CARLETON('help.json'), maxAge: HOUR},
	'/webcams': {url: CARLETON('webcams.json'), maxAge: HOUR},
	'/spaces/hours': {url: CARLETON('building-hours.json'), maxAge: HOUR},
	'/map': {url: CARLETON_MAP('map.json'), maxAge: HOUR},
	'/map/geojson': {url: CARLETON_MAP('map.geojson'), maxAge: HOUR},
}
