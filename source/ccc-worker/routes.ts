import type {Hono} from 'hono'
import type {AppEnv} from './env.ts'

export interface RouteInfo {
	path: string
	displayName: string
	params: string[]
}

const LEADING_VERSION = /\/v[0-9]\//

/// The route list the smoke test and the app's debug screen read. Hono lists a
/// route once per handler (middleware included), so paths are de-duplicated.
export function listRoutes(api: Hono<AppEnv>): RouteInfo[] {
	let paths = new Set(api.routes.filter((r) => r.method === 'GET').map((r) => r.path))
	return Array.from(paths, (path) => ({
		path,
		displayName: path.split(LEADING_VERSION).slice(1).join(),
		params: Array.from(path.matchAll(/:(\w+)/g), (m) => m[1] ?? ''),
	})).toSorted((a, b) => a.path.localeCompare(b.path))
}
