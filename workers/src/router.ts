import {CafeMenuWithError, CustomCafe, cafeFrom, menuFrom} from '../../source/menus-bonapp/shape.ts'
import {CAFES} from './cafes.ts'
import {fetchSource} from './client.ts'
import {clock} from './clock.ts'
import {bonappPage, campusToday} from './sources/bonapp.ts'

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
function cafeUrl(cafeId: string): string | Response {
	let url = Object.hasOwn(CAFES, cafeId) ? CAFES[cafeId] : undefined
	return url ?? json({message: `cafeId must be one of ${Object.keys(CAFES).join(', ')}`}, 400)
}

/// The apps' menu and café info for a BonApp café, in the contract the Node
/// server's /v1/food routes keep. A failure with nothing stored is still a
/// 200 with a stand-in, which is what the apps already know how to show.
async function food(kind: 'menu' | 'cafe', cafeId: string, env: Env): Promise<Response> {
	let url = cafeUrl(cafeId)
	if (url instanceof Response) return url

	let date = campusToday(new Date(clock.now()))
	try {
		let {value} = await fetchSource(env, bonappPage, {url})
		return kind === 'menu'
			? json(menuFrom(value, date), 200, ONE_HOUR)
			: json(cafeFrom(value, date), 200, ONE_HOUR)
	} catch (err) {
		console.error(err, {cafeId})
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
async function bonapp(cafeId: string, full: boolean, env: Env): Promise<Response> {
	let url = Object.hasOwn(CAFES, cafeId) ? CAFES[cafeId] : undefined
	if (url === undefined) {
		return json({error: `unknown café ${cafeId}`, known: Object.keys(CAFES)}, 404)
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

export async function route(request: Request, env: Env): Promise<Response> {
	let url = new URL(request.url)
	if (request.method !== 'GET') return json({error: 'method not allowed'}, 405)

	if (url.pathname === '/') return json({cafes: CAFES})

	let eating = /^\/v1\/food\/(menu|cafe)\/([^/]+)$/.exec(url.pathname)
	if (eating?.[1] && eating[2]) return food(eating[1] as 'menu' | 'cafe', eating[2], env)

	let match = /^\/bonapp\/([^/]+)$/.exec(url.pathname)
	if (match?.[1]) return bonapp(match[1], url.searchParams.get('full') === '1', env)

	return json({error: 'not found'}, 404)
}
