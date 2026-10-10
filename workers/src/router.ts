import {CAFES} from './cafes.ts'
import {fetchSource} from './client.ts'
import {bonappPage} from './sources/bonapp.ts'

const json = (body: unknown, status = 200) => Response.json(body, {status})

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

	let match = /^\/bonapp\/([^/]+)$/.exec(url.pathname)
	if (match?.[1]) return bonapp(match[1], url.searchParams.get('full') === '1', env)

	return json({error: 'not found'}, 404)
}
