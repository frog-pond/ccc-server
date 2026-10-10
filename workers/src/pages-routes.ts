export type PagesRoute = {
	/// the url the data is published at
	url: string
}

// where each college publishes its data files
const STOLAF = (file: string) => `https://stolaf.dev/AAO-React-Native/${file}`
const STOLAF_MAP = (file: string) => `https://stolaf.dev/campus-map-data/${file}`
const CARLETON = (file: string) => `https://carls-app.github.io/carls/${file}`
const CARLETON_MAP = (file: string) => `https://carls-app.github.io/map-data/${file}`

/// St. Olaf's published data files, by path, each answered with a temporary
/// redirect to where it is published.
export const STOLAF_FILES: Record<string, PagesRoute> = {
	'/contacts': {url: STOLAF('contact-info.json')},
	'/dictionary': {url: STOLAF('dictionary.json')},
	'/faqs': {url: STOLAF('faqs.json')},
	'/tools/help': {url: STOLAF('help.json')},
	'/webcams': {url: STOLAF('webcams.json')},
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

/// St. Olaf's building hours and break calendar, which are read together.
export const STOLAF_SCHEDULES = {
	hoursUrl: STOLAF('building-hours.json'),
	breaksUrl: STOLAF('breaks.json'),
}

/// What St. Olaf answers with a temporary redirect to where the file is
/// published, by path. The client then reads the file from there, with its
/// host's own ETag and caching.
export const STOLAF_REDIRECTS: Record<string, string> = {
	'/transit/bus': STOLAF('bus-times.json'),
	'/transit/modes': STOLAF('transportation.json'),
	'/printing/color-printers': STOLAF('color-printers.json'),
	'/reports/stav': 'https://stolaf.dev/stav-mealtimes/two-weeks.json',
	'/food/named/menu/the-pause': STOLAF('pause-menu.json'),
	'/courses/catalog.db': 'https://stolaf.dev/course-data/catalog-recent.db',
}

/// Carleton's published data files, by path, each answered with a temporary
/// redirect to where it is published.
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

/// What Carleton answers with a temporary redirect to where the file is
/// published, by path.
export const CARLETON_REDIRECTS: Record<string, string> = {
	'/transit/bus': CARLETON('bus-times.json'),
	'/transit/modes': CARLETON('transportation.json'),
	'/food/named/menu/the-pause': CARLETON('pause-menu.json'),
}
