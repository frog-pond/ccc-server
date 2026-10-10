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

/// TEMPORARY: St. Olaf's WordPress blocks the Node server's IP, and whether it
/// blocks a Worker's is unknown. Fetches a fixed url per name (this is not a
/// proxy) and reports what came back, without relaying the body.
const PROBES: Record<string, string> = {
	'wp-stolaf': 'https://wp.stolaf.edu/wp-json/wp/v2/posts?per_page=1',
	olafmessenger: 'https://www.olafmessenger.com/wp-json/wp/v2/posts/?per_page=1',
}

async function probe(name: string, asNode: boolean): Promise<Response> {
	let url = Object.hasOwn(PROBES, name) ? PROBES[name] : undefined
	if (url === undefined)
		return json({error: `unknown probe ${name}`, known: Object.keys(PROBES)}, 404)

	try {
		let response = await fetch(url, asNode ? {headers: {'User-Agent': 'ccc-server/0.2.0'}} : {})
		let text = await response.text()
		let isJson = true
		try {
			JSON.parse(text)
		} catch {
			isJson = false
		}
		return json({
			name,
			url,
			as: asNode ? 'node' : 'worker default',
			status: response.status,
			server: response.headers.get('server'),
			contentType: response.headers.get('content-type'),
			bytes: text.length,
			json: isJson,
			snippet: text.slice(0, 120),
		})
	} catch (err) {
		return json({name, url, error: err instanceof Error ? err.message : String(err)}, 502)
	}
}

export async function route(request: Request, env: Env): Promise<Response> {
	let url = new URL(request.url)
	if (request.method !== 'GET') return json({error: 'method not allowed'}, 405)

	if (url.pathname === '/') return json({cafes: CAFES})

	let match = /^\/bonapp\/([^/]+)$/.exec(url.pathname)
	if (match?.[1]) return bonapp(match[1], url.searchParams.get('full') === '1', env)

	let probing = /^\/probe\/([^/]+)$/.exec(url.pathname)
	if (probing?.[1]) return probe(probing[1], url.searchParams.get('as') === 'node')

	return json({error: 'not found'}, 404)
}
