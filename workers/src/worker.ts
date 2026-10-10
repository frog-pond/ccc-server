export {SourceDO} from './source-do.ts'

export default {
	fetch: () => new Response('not found', {status: 404}),
} satisfies ExportedHandler<Env>
