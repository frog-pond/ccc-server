import {WorkerEntrypoint} from 'cloudflare:workers'
import {withETag} from './etag.ts'
import {legacy, legacyCampus} from './legacy.ts'
import {route} from './router.ts'
import {note} from './trace.ts'

export {ArchiveDO} from './archive-do.ts'
export {SourceDO} from './source-do.ts'
export {StudentOrgsDO} from './student-orgs-do.ts'
export {StudentWorkDO} from './student-work-do.ts'

/// The campus routes, behind Workers Cache, which keys them by path and never
/// by host (workers/README.md).
export class CachedRoutes extends WorkerEntrypoint<Env> {
	override fetch(request: Request): Promise<Response> {
		return route(request, this.env)
	}
}

export default {
	fetch: async (request, env, ctx) => {
		// Sentry's webhooks are posted, and never come from the cache.
		let routes = (inner: Request) =>
			inner.method === 'GET' ? ctx.exports.CachedRoutes.fetch(inner) : route(inner, env)
		let answer = (await legacy(request, routes)) ?? (await routes(request))
		let response = await withETag(request, answer)
		// the runtime traces the request but not what it was answered with
		note({
			'ccc.legacy_host': legacyCampus(new URL(request.url)) !== undefined,
			'http.response.status_code': response.status,
		})
		return response
	},
} satisfies ExportedHandler<Env>
