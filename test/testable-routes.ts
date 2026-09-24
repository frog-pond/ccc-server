/// Routes the route walk skips, and why. Shared by the replay tests, fixture
/// recording, the live smoke test, and the parity check, so all four agree.
export const SKIPPED_ROUTES: ReadonlyMap<string, string> = new Map([
	['/v1/convos/upcoming', "needs a Google Calendar key, which smoke tests don't have"],
	['/v1/news/rss', 'needs a ?url'],
	['/v1/news/wpjson', 'needs a ?url'],
	['/v1/util/html-to-md', 'needs a JSON body'],
	['/v1/news/named/oleville', "oleville breaks often and isn't worth testing"],
	['/v1/news/named/mess', "mess breaks often and isn't worth testing"],
	['/v1/news/named/nnb', 'nnb is broken'],
	['/v1/jobs', 'jobs are currently broken endpoints'],
	['/v1/orgs', 'presence is slow, and needs the Workers Paid plan (228 subrequests)'],
])

export function testableRoutes(routes: {path: string}[]): string[] {
	return routes
		.map((route) => route.path)
		.filter((path) => !path.startsWith('/v1/calendar/'))
		.filter((path) => !path.includes('/:'))
		.filter((path) => !SKIPPED_ROUTES.has(path))
}
