import {withETag} from './etag.ts'
import {legacy} from './legacy.ts'
import {route} from './router.ts'

export {ArchiveDO} from './archive-do.ts'
export {SourceDO} from './source-do.ts'
export {StudentOrgsDO} from './student-orgs-do.ts'
export {StudentWorkDO} from './student-work-do.ts'

export default {
	fetch: async (request, env) => {
		let answer =
			(await legacy(request, (inner) => route(inner, env))) ?? (await route(request, env))
		return withETag(request, answer)
	},
} satisfies ExportedHandler<Env>
