import {CafeMenuWithError, CustomCafe, cafeFrom, menuFrom} from '../../source/menus-bonapp/shape.ts'
import {CAMPUSES, type Campus, type NewsFeed} from './campuses.ts'
import type {Calendar} from './calendars.ts'
import type {PagesRoute} from './pages-routes.ts'
import {fetchSource} from './client.ts'
import {clock} from './clock.ts'
import {CLIENT_MAX_AGE, ERROR_MAX_AGE} from './lifetimes.ts'
import {pagesJson} from './sources/pages-json.ts'
import {wordpress as wordpressApi} from './sources/wordpress-api.ts'
import {posting, postings, units} from './student-work.ts'
import {carletonPosting, carletonPostings} from './carleton-student-work.ts'
import {jobs, org, orgCategories, orgs} from './student-orgs.ts'
import {bonappPage, campusToday, secondsUntilCampusMidnight} from './sources/bonapp.ts'
import {schedules, type ScheduleParams} from './sources/schedules.ts'
import {imageUrl, isPublishedImage} from '../../source/ccc-lib/images-shape.ts'
import {routeListing} from './routes.ts'

const json = (body: unknown, status = 200, cacheSeconds?: number) =>
	Response.json(body, {
		status,
		...(cacheSeconds === undefined
			? {}
			: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
	})

// A failure is kept briefly: the Node server cached its error menu for an
// hour, so one bad refresh outlasted BonApp coming back.
const ONE_MINUTE = ERROR_MAX_AGE

/// A café from the path, or the 400 the Node server answers an unknown one with.
function cafeUrl(campus: Campus, cafeId: string): string | Response {
	let url = Object.hasOwn(campus.cafes, cafeId) ? campus.cafes[cafeId] : undefined
	return (
		url ?? json({message: `cafeId must be one of ${Object.keys(campus.cafes).join(', ')}`}, 400)
	)
}

/// The apps' menu and café info for a BonApp café, in the contract the Node
/// server's /v1/food routes keep. A failure with nothing stored is still a
/// 200 with a stand-in, which is what the apps already know how to show.
async function food(kind: 'menu' | 'cafe', url: string, env: Env): Promise<Response> {
	try {
		let {value} = await fetchSource(env, bonappPage, {url})
		// read after the fetch, which can run across campus midnight: the response
		// is dated by the day it is made on, and not kept past that day's end
		let now = new Date(clock.now())
		let date = campusToday(now)
		let keep = Math.min(CLIENT_MAX_AGE, secondsUntilCampusMidnight(now))
		return kind === 'menu'
			? json(menuFrom(value, date), 200, keep)
			: json(cafeFrom(value, date), 200, keep)
	} catch (err) {
		console.error(err, {url})
		let date = campusToday(new Date(clock.now()))
		return kind === 'menu'
			? json(
					CafeMenuWithError(
						err instanceof Error ? err.message : String(err),
						'Could not load the BonApp menu data',
						date,
					),
					200,
					ONE_MINUTE,
				)
			: json(CustomCafe('Could not load café from BonApp', date), 200, ONE_MINUTE)
	}
}

/// A look at the BonApp source while the real routes are not built yet: what
/// the object holds for a café, and how it was served. Not the app's menu
/// contract.
async function bonapp(campus: Campus, cafeId: string, full: boolean, env: Env): Promise<Response> {
	let url = Object.hasOwn(campus.cafes, cafeId) ? campus.cafes[cafeId] : undefined
	if (url === undefined) {
		return json({error: `unknown café ${cafeId}`, known: Object.keys(campus.cafes)}, 404)
	}

	try {
		let {value, fetchedAt, state} = await fetchSource(env, bonappPage, {url})
		let summary = value && {
			name: value.current_cafe.name,
			dayparts: Object.values(value.dayparts).map(({label}) => label),
			itemCount: Object.keys(value.menu_items).length,
		}
		return json({cafeId, url, state, fetchedAt, summary, ...(full ? {page: value} : {})})
	} catch (err) {
		return json({cafeId, url, error: err instanceof Error ? err.message : String(err)}, 502)
	}
}

/// A news feed as feed items. Unlike the Node server (a stub for St. Olaf, and
/// an empty list for a feed it cannot read), with nothing stored and the site
/// failing this is a 502, kept briefly, not a feed.
async function news(env: Env, {read}: NewsFeed): Promise<Response> {
	try {
		return json(await read(env), 200, CLIENT_MAX_AGE)
	} catch (err) {
		console.error(err)
		return json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)
	}
}

/// A calendar as events. With nothing stored and the source failing this is a
/// 502, kept briefly, as for the news feeds.
async function calendar(env: Env, {read}: Calendar): Promise<Response> {
	try {
		return json(await read(env), 200, CLIENT_MAX_AGE)
	} catch (err) {
		console.error(err)
		return json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)
	}
}

/// A data file the colleges publish, passed through as it is. A failure with
/// nothing stored is a 502, kept briefly, as for the news feeds.
async function dataFile(env: Env, {url}: PagesRoute): Promise<Response> {
	try {
		let {value} = await fetchSource(env, pagesJson, {url})
		return json(value, 200, CLIENT_MAX_AGE)
	} catch (err) {
		console.error(err, {url})
		return json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)
	}
}

/// A temporary redirect to where a file is published. Temporary, so a client
/// asks here again and the file can be served from here later.
const redirect = (location: string) =>
	new Response(null, {
		status: 307,
		headers: {Location: location, 'Cache-Control': `public, max-age=${CLIENT_MAX_AGE.toFixed(0)}`},
	})

/// The building hours or the break calendar, resolved together, as the Node
/// server's `/spaces/hours` and `/breaks` answer them. A failure with nothing
/// stored is a 502, kept briefly.
async function schedule(
	env: Env,
	params: ScheduleParams,
	which: 'hours' | 'calendar',
): Promise<Response> {
	try {
		let {value} = await fetchSource(env, schedules, params)
		return json(value[which], 200, CLIENT_MAX_AGE)
	} catch (err) {
		console.error(err)
		return json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)
	}
}

export async function route(request: Request, env: Env): Promise<Response> {
	let url = new URL(request.url)
	if (request.method !== 'GET') return json({error: 'method not allowed'}, 405)

	if (url.pathname === '/') return json({campuses: [...CAMPUSES.keys()]})

	// every other route is under a campus: /edu.stolaf/..., /edu.carleton/...
	let mounted = /^\/([^/]+)(\/.*)$/.exec(url.pathname)
	let prefix = mounted?.[1]
	let campus = prefix ? CAMPUSES.get(prefix) : undefined
	let path = mounted?.[2]
	if (!prefix || !campus || !path) return json({error: 'not found'}, 404)

	let feed = /^\/news\/([^/]+)$/.exec(path)?.[1]
	if (feed !== undefined && Object.hasOwn(campus.news, feed) && campus.news[feed]) {
		return news(env, campus.news[feed])
	}

	let wordpress = /^\/news\/([^/]+)\/wp\/v2\/([^/]+)(?:\/([^/]+))?$/.exec(path)
	let site = wordpress?.[1]
	if (wordpress?.[2] && site !== undefined && Object.hasOwn(campus.wordpressNews, site)) {
		let paper = campus.wordpressNews[site]
		if (paper) return wordpressApi(paper, url, wordpress[2], wordpress[3], env)
	}

	let named = /^\/calendar\/([^/]+)$/.exec(path)?.[1]
	if (named !== undefined && Object.hasOwn(campus.calendars, named) && campus.calendars[named]) {
		return calendar(env, campus.calendars[named])
	}

	if (path === '/convos/upcoming' && campus.convos) return calendar(env, campus.convos)

	if (path === '/routes') return json(routeListing(prefix, campus), 200, CLIENT_MAX_AGE)

	if (Object.hasOwn(campus.notices, path)) return json(campus.notices[path], 200, CLIENT_MAX_AGE)

	let location = Object.hasOwn(campus.redirects, path) ? campus.redirects[path] : undefined
	if (location) return redirect(location)

	if (campus.schedules) {
		if (path === '/spaces/hours') return schedule(env, campus.schedules, 'hours')
		if (path === '/breaks') return schedule(env, campus.schedules, 'calendar')
	}

	// only the app's published images, and one address for each (Node keeps
	// the same rule, `isPublishedImage`, in source/ccc-lib/images-shape.ts)
	let image = /^\/images\/([^/]+)\/([^/]+)$/.exec(path)
	if (image?.[1] && image[2] && campus.images) {
		if (url.search || !isPublishedImage(image[1], image[2])) return json({error: 'not found'}, 404)
		return redirect(imageUrl(image[1], image[2]).href)
	}

	let file = Object.hasOwn(campus.files, path) ? campus.files[path] : undefined
	if (file) return dataFile(env, file)

	let work = campus.studentWork
	if (work?.board === 'oracle') {
		if (path === '/student-work/postings') return postings(env, work, url.searchParams)
		if (path === '/student-work/units') return units(env, work)
		let id = /^\/student-work\/postings\/(\d{1,12})$/.exec(path)?.[1]
		if (id) return posting(env, work, id)
	}
	if (work?.board === 'wordpress') {
		if (path === '/student-work/postings') return carletonPostings(env, url.searchParams)
		let id = /^\/student-work\/postings\/(\d{1,12})$/.exec(path)?.[1]
		if (id) return carletonPosting(env, id)
	}

	if (campus.orgs) {
		if (path === '/orgs') return orgs(env, campus.orgs, url.searchParams)
		if (campus.orgs === 'presence') {
			if (path === '/orgs/categories') return orgCategories(env)
			let uri = /^\/orgs\/uri\/([^/]+)$/.exec(path)?.[1]
			if (uri !== undefined) return org(env, uri)
		}
	}

	if (path === '/jobs' && campus.jobs) return jobs(env, campus.jobs)

	let eating = /^\/food\/(menu|cafe)\/([^/]+)$/.exec(path)
	if (eating?.[1] && eating[2]) {
		let cafe = cafeUrl(campus, eating[2])
		if (cafe instanceof Response) return cafe
		return food(eating[1] as 'menu' | 'cafe', cafe, env)
	}

	let namedFood = /^\/food\/named\/(menu|cafe)\/([^/]+)$/.exec(path)
	let namedCafe =
		namedFood?.[2] && Object.hasOwn(campus.namedCafes, namedFood[2])
			? campus.namedCafes[namedFood[2]]
			: undefined
	if (namedFood?.[1] && namedCafe) return food(namedFood[1] as 'menu' | 'cafe', namedCafe, env)

	let match = /^\/bonapp\/([^/]+)$/.exec(path)
	if (match?.[1]) return bonapp(campus, match[1], url.searchParams.get('full') === '1', env)

	return json({error: 'not found'}, 404)
}
