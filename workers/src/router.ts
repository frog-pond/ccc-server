import {CafeMenuWithError, CustomCafe, cafeFrom, menuFrom} from '../../source/menus-bonapp/shape.ts'
import {CAMPUSES, type Campus, type NewsFeed} from './campuses.ts'
import type {Calendar} from './calendars.ts'
import type {PagesRoute} from './pages-routes.ts'
import {fetchSource} from './client.ts'
import {clock} from './clock.ts'
import {pagesJson} from './sources/pages-json.ts'
import {bonappPage, campusToday, secondsUntilCampusMidnight} from './sources/bonapp.ts'

const json = (body: unknown, status = 200, cacheSeconds?: number) =>
	Response.json(body, {
		status,
		...(cacheSeconds === undefined
			? {}
			: {headers: {'Cache-Control': `public, max-age=${cacheSeconds.toFixed(0)}`}}),
	})

/// What the apps are told to keep a response for. A failure is kept briefly: the
/// Node server cached its error menu for an hour, so one bad refresh outlasted
/// BonApp coming back.
const ONE_HOUR = 60 * 60
const ONE_MINUTE = 60

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
async function food(
	campus: Campus,
	kind: 'menu' | 'cafe',
	cafeId: string,
	env: Env,
): Promise<Response> {
	let url = cafeUrl(campus, cafeId)
	if (url instanceof Response) return url

	try {
		let {value} = await fetchSource(env, bonappPage, {url})
		// read after the fetch, which can run across campus midnight: the response
		// is dated by the day it is made on, and not kept past that day's end
		let now = new Date(clock.now())
		let date = campusToday(now)
		let keep = Math.min(ONE_HOUR, secondsUntilCampusMidnight(now))
		return kind === 'menu'
			? json(menuFrom(value, date), 200, keep)
			: json(cafeFrom(value, date), 200, keep)
	} catch (err) {
		console.error(err, {cafeId})
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
async function news(env: Env, {source, url}: NewsFeed): Promise<Response> {
	try {
		let {value} = await fetchSource(env, source, {url})
		return json(value, 200, ONE_HOUR)
	} catch (err) {
		console.error(err, {url})
		return json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)
	}
}

/// A calendar as events. With nothing stored and the source failing this is a
/// 502, kept briefly, as for the news feeds.
async function calendar(env: Env, {read, maxAge}: Calendar): Promise<Response> {
	try {
		return json(await read(env), 200, maxAge)
	} catch (err) {
		console.error(err)
		return json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)
	}
}

/// A data file the colleges publish, passed through as it is. A failure with
/// nothing stored is a 502, kept briefly, as for the news feeds.
async function dataFile(env: Env, {url, maxAge}: PagesRoute): Promise<Response> {
	try {
		let {value} = await fetchSource(env, pagesJson, {url})
		return json(value, 200, maxAge)
	} catch (err) {
		console.error(err, {url})
		return json({message: err instanceof Error ? err.message : String(err)}, 502, ONE_MINUTE)
	}
}

export async function route(request: Request, env: Env): Promise<Response> {
	let url = new URL(request.url)
	if (request.method !== 'GET') return json({error: 'method not allowed'}, 405)

	if (url.pathname === '/') return json({campuses: [...CAMPUSES.keys()]})

	// every other route is under a campus: /edu.stolaf/..., /edu.carleton/...
	let mounted = /^\/([^/]+)(\/.*)$/.exec(url.pathname)
	let campus = mounted?.[1] ? CAMPUSES.get(mounted[1]) : undefined
	let path = mounted?.[2]
	if (!campus || !path) return json({error: 'not found'}, 404)

	let feed = /^\/news\/([^/]+)$/.exec(path)?.[1]
	if (feed !== undefined && Object.hasOwn(campus.news, feed) && campus.news[feed]) {
		return news(env, campus.news[feed])
	}

	let named = /^\/calendar\/([^/]+)$/.exec(path)?.[1]
	if (named !== undefined && Object.hasOwn(campus.calendars, named) && campus.calendars[named]) {
		return calendar(env, campus.calendars[named])
	}

	if (path === '/convos/upcoming' && campus.convos) return calendar(env, campus.convos)

	let file = Object.hasOwn(campus.files, path) ? campus.files[path] : undefined
	if (file) return dataFile(env, file)

	let eating = /^\/food\/(menu|cafe)\/([^/]+)$/.exec(path)
	if (eating?.[1] && eating[2]) return food(campus, eating[1] as 'menu' | 'cafe', eating[2], env)

	let match = /^\/bonapp\/([^/]+)$/.exec(path)
	if (match?.[1]) return bonapp(campus, match[1], url.searchParams.get('full') === '1', env)

	return json({error: 'not found'}, 404)
}
