import {route} from './router.ts'

export {SourceDO} from './source-do.ts'
export {StudentWorkDO} from './student-work-do.ts'

export default {
	fetch: (request, env) => route(request, env),
} satisfies ExportedHandler<Env>
