import {withETag} from './etag.ts'
import {route} from './router.ts'

export {SourceDO} from './source-do.ts'
export {StudentOrgsDO} from './student-orgs-do.ts'
export {StudentWorkDO} from './student-work-do.ts'

export default {
	fetch: async (request, env) => withETag(request, await route(request, env)),
} satisfies ExportedHandler<Env>
