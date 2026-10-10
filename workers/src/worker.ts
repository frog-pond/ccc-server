export {SourceDO} from './source-do.ts'

// Sources register themselves when their module loads, and the object runs
// from this file, so each one has to be imported here
import './sources/bonapp.ts'

export default {
	fetch: () => new Response('not found', {status: 404}),
} satisfies ExportedHandler<Env>
