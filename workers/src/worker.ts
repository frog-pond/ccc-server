import {withETag} from './etag.ts'
import {legacy, legacyCampus} from './legacy.ts'
import {route} from './router.ts'
import {note} from './trace.ts'

export {ArchiveDO} from './archive-do.ts'
export {SourceDO} from './source-do.ts'
export {StudentOrgsDO} from './student-orgs-do.ts'
export {StudentWorkDO} from './student-work-do.ts'

export default {
	fetch: async (request, env) => {
		let answer =
			(await legacy(request, (inner) => route(inner, env))) ?? (await route(request, env))
		let response = await withETag(request, answer)
		// the runtime traces the request but not what it was answered with
		note({
			'ccc.legacy_host': legacyCampus(new URL(request.url)) !== undefined,
			'http.response.status_code': response.status,
		})
		return response
	},
} satisfies ExportedHandler<Env>
