import {CAMPUSES} from './campuses.ts'
import {CLIENT_MAX_AGE} from './lifetimes.ts'
import {campusPaths, type ListedRoute} from './routes.ts'

/// The Node server's addresses, as the apps already ship them: one host per
/// campus (`stolaf.api.frogpond.tech`, `carleton.api.frogpond.tech`, or their
/// emoji names), with routes under `/v1`. On such a host a `/v1` path is
/// answered by the campus route it names, so the same Worker serves old builds
/// and new ones. The Node server also answers its `/v1` routes under the campus
/// prefixes (`/edu.stolaf/v1/...`), and so does the Worker, on any host.

/// A host's first label, and the campus it stands for. Emoji labels arrive in
/// their punycode form.
const HOST_CAMPUSES: Record<string, string> = {
	stolaf: 'edu.stolaf',
	'xn--0s9h': 'edu.stolaf', // 🦁
	carleton: 'edu.carleton',
	'xn--vo8h': 'edu.carleton', // 🐧
}

/// The campus a request's host names, if it is one of the Node server's.
export function legacyCampus(url: URL): string | undefined {
	let label = url.hostname.split('.')[0] ?? ''
	return Object.hasOwn(HOST_CAMPUSES, label) ? HOST_CAMPUSES[label] : undefined
}

/// Where a request's Node routes are: the campus, the mount its `/v1` paths
/// sit under (`/edu.stolaf`, or nothing on a Node host), and the path below
/// that mount. Undefined for a request to neither form.
export function legacyMount(url: URL): {campus: string; mount: string; path: string} | undefined {
	let prefixed = /^\/([^/]+)(\/v1(?:\/.*)?)$/u.exec(url.pathname)
	let prefix = prefixed?.[1]
	if (prefix && CAMPUSES.has(prefix)) {
		return {campus: prefix, mount: `/${prefix}`, path: prefixed?.[2] ?? ''}
	}
	let campus = legacyCampus(url)
	return campus ? {campus, mount: '', path: url.pathname} : undefined
}

/// A Node path as the campus route it names: `/v1` dropped, and the named
/// news and calendars without their `named` segment. Undefined for a path
/// outside `/v1`.
export function fromLegacyPath(path: string): string | undefined {
	let rest = /^\/v1(\/.*)$/u.exec(path)?.[1]
	if (rest === undefined) return undefined
	return rest.replace(/^\/(news|calendar)\/named\/([^/]+)$/u, '/$1/$2')
}

/// A campus path as the Node server spelled it.
export function toLegacyPath(path: string): string {
	let feed = /^\/(news|calendar)\/([^/]+)$/u.exec(path)
	return `/v1${feed ? `/${feed[1] ?? ''}/named/${feed[2] ?? ''}` : path}`
}

/// The campus's routes in the Node server's `/v1/routes` shape, at their Node
/// addresses under `mount`, with its greeting and ping.
export function legacyRouteListing(campus: string, mount = ''): ListedRoute[] {
	let table = CAMPUSES.get(campus)
	if (!table) return []
	let paths = ['/', '/ping', ...campusPaths(table).map(toLegacyPath)]
	return paths
		.map((path) => ({
			path: `${mount}${path}`,
			displayName: path.replace(/^\/v[0-9]+(?:\.[0-9]+)*\//u, ''),
			methods: ['GET'],
			params: [...path.matchAll(/:([a-zA-Z]+)/gu)].map(([, name]) => name ?? ''),
		}))
		.toSorted((a, b) => a.path.localeCompare(b.path))
}

const text = (body: string) =>
	new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': `public, max-age=${CLIENT_MAX_AGE.toFixed(0)}`,
		},
	})

/// Answers a request at one of the Node server's addresses: on a Node host its
/// greeting and ping directly, its route listing directly, and a `/v1` route by
/// asking `route` for the campus route it names. A `Link` the answer carries
/// points back at Node addresses under the same mount. Undefined when the
/// request is not at a Node address, so the campus routes answer as usual.
export async function legacy(
	request: Request,
	route: (request: Request) => Promise<Response>,
): Promise<Response | undefined> {
	let url = new URL(request.url)
	let found = legacyMount(url)
	if (!found || request.method !== 'GET') return undefined
	let {campus, mount} = found
	if (!mount && found.path === '/') return text('Hello world!')
	if (!mount && found.path === '/ping') return text('pong')
	if (found.path === '/v1/routes') {
		return Response.json(legacyRouteListing(campus, mount), {
			headers: {'Cache-Control': `public, max-age=${CLIENT_MAX_AGE.toFixed(0)}`},
		})
	}
	let path = fromLegacyPath(found.path)
	if (path === undefined) return undefined

	let inner = new URL(url)
	inner.pathname = `/${campus}${path}`
	let response = await route(new Request(inner, request))

	let link = response.headers.get('Link')
	if (!link) return response
	let prefix = `/${campus}/`
	let rewritten = link.replace(/<([^>]*)>/gu, (whole, target: string) => {
		if (!target.startsWith(prefix)) return whole
		let [pathname = '', query] = target.slice(prefix.length - 1).split(/\?(.*)/su)
		return `<${mount}${toLegacyPath(pathname)}${query === undefined ? '' : `?${query}`}>`
	})
	let headers = new Headers(response.headers)
	headers.set('Link', rewritten)
	return new Response(response.body, {status: response.status, headers})
}
