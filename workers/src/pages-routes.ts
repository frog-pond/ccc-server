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

/// Routes both colleges have, with a different file behind each. These are
/// served under `/edu.stolaf` and `/edu.carleton`, since one plain path could
/// answer only one of them.
const BOTH: Record<string, {stolaf: PagesRoute; carleton: PagesRoute}> = {
	'/contacts': {
		stolaf: {url: STOLAF('contact-info.json'), maxAge: DAY},
		carleton: {url: CARLETON('contact-info.json'), maxAge: HOUR},
	},
	'/dictionary': {
		stolaf: {url: STOLAF('dictionary.json'), maxAge: DAY},
		carleton: {url: CARLETON('dictionary-carls.json'), maxAge: HOUR},
	},
	'/faqs': {
		stolaf: {url: STOLAF('faqs.json'), maxAge: DAY},
		carleton: {url: CARLETON('faqs.json'), maxAge: HOUR},
	},
	'/tools/help': {
		stolaf: {url: STOLAF('help.json'), maxAge: DAY},
		carleton: {url: CARLETON('help.json'), maxAge: HOUR},
	},
	'/webcams': {
		stolaf: {url: STOLAF('webcams.json'), maxAge: DAY},
		carleton: {url: CARLETON('webcams.json'), maxAge: HOUR},
	},
	'/spaces/hours': {
		stolaf: {url: STOLAF('building-hours.json'), maxAge: HOUR},
		carleton: {url: CARLETON('building-hours.json'), maxAge: HOUR},
	},
	'/map': {
		stolaf: {url: STOLAF_MAP('map.json'), maxAge: HOUR},
		carleton: {url: CARLETON_MAP('map.json'), maxAge: HOUR},
	},
	'/map/geojson': {
		stolaf: {url: STOLAF_MAP('map.geojson'), maxAge: HOUR},
		carleton: {url: CARLETON_MAP('map.geojson'), maxAge: HOUR},
	},
}

/// Routes only one college has, so they keep their plain path.
const ONLY: Record<string, PagesRoute> = {
	'/sources': {url: STOLAF('sources.json'), maxAge: DAY},
	'/spaces/directory': {url: STOLAF('building-directory.json'), maxAge: HOUR},
	'/a-to-z/extras': {url: STOLAF('a-to-z.json'), maxAge: DAY},
	'/orgs/category-styles': {url: STOLAF('org-categories.json'), maxAge: DAY},
	'/map/categories': {url: STOLAF('map-categories.json'), maxAge: DAY},
	'/map/style': {url: STOLAF_MAP('style.json'), maxAge: HOUR},
	'/map/style-dark': {url: STOLAF_MAP('style-dark.json'), maxAge: HOUR},
	'/student-work/areas': {url: STOLAF('student-work-areas.json'), maxAge: DAY},
	'/student-work/wages': {url: STOLAF('student-wages.json'), maxAge: DAY},
}

/// Every data-file route, by the path it is served at.
export const PAGES_ROUTES: ReadonlyMap<string, PagesRoute> = new Map([
	...Object.entries(ONLY),
	...Object.entries(BOTH).flatMap(([path, {stolaf, carleton}]) => [
		[`/edu.stolaf${path}`, stolaf] as const,
		[`/edu.carleton${path}`, carleton] as const,
	]),
])
