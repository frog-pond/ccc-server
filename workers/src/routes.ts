import type {Campus} from './campuses.ts'

/// One route a campus serves, as the Node server's `/v1/routes` lists one.
export type ListedRoute = {
	path: string
	displayName: string
	methods: string[]
	params: string[]
}

/// Every path a campus's table serves, with `:name` for a part of the path the
/// route reads. It follows `route()` in `src/router.ts`; a test asks each path
/// listed here of the router.
export function campusPaths(campus: Campus): string[] {
	let paths = [
		'/routes',
		'/food/menu/:cafeId',
		'/food/cafe/:cafeId',
		'/bonapp/:cafeId',
		...Object.keys(campus.namedCafes).flatMap((name) => [
			`/food/named/menu/${name}`,
			`/food/named/cafe/${name}`,
		]),
		...Object.keys(campus.news).map((name) => `/news/${name}`),
		...Object.keys(campus.wordpressNews).flatMap((site) => [
			`/news/${site}/wp/v2/:resource`,
			`/news/${site}/wp/v2/:resource/:id`,
		]),
		...Object.keys(campus.calendars).map((name) => `/calendar/${name}`),
		...Object.keys(campus.files),
		...Object.keys(campus.redirects),
		...Object.keys(campus.notices),
	]
	if (campus.convos) paths.push('/convos/upcoming')
	if (campus.convoDetails) paths.push('/convos/upcoming/:id', '/convos/archived')
	if (campus.athletics) paths.push('/athletics/scores')
	paths.push(...Object.keys(campus.directory))
	if (campus.streams) paths.push('/streams/upcoming', '/streams/archived', '/streams/search')
	if (campus.schedules) paths.push('/spaces/hours', '/breaks')
	if (campus.images) paths.push('/images/:group/:name')
	if (campus.studentWork) paths.push('/student-work/postings', '/student-work/postings/:id')
	if (campus.studentWork?.board === 'oracle') paths.push('/student-work/units')
	if (campus.orgs) paths.push('/orgs')
	if (campus.orgs === 'presence') paths.push('/orgs/categories', '/orgs/uri/:uri')
	if (campus.jobs) paths.push('/jobs')
	return paths
}

/// The routes a campus serves, in the shape of the Node server's
/// `/v1/routes`: each path under the campus's prefix, sorted.
export function routeListing(prefix: string, campus: Campus): ListedRoute[] {
	return campusPaths(campus)
		.map((path) => ({
			path: `/${prefix}${path}`,
			displayName: path.slice(1),
			methods: ['GET'],
			params: [...path.matchAll(/:([a-zA-Z]+)/gu)].map(([, name]) => name ?? ''),
		}))
		.toSorted((a, b) => a.path.localeCompare(b.path))
}
