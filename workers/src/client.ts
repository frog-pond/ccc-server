import type {Served, Source, SourceResult} from './define-source.ts'
import {inSpan, note} from './trace.ts'

/// A source's value from its Durable Object, traced as `source <name>` with
/// how the object served it: fresh, stale while it refreshes, stale because
/// the site is failing, or an error.
export function fetchSource<P, V>(env: Env, source: Source<P, V>, params: P): Promise<Served<V>> {
	return inSpan(`source ${source.name}`, async () => {
		let stub = env.SOURCE.getByName(`${source.name}:${source.key(params)}`)
		let result = (await stub.get(source.name, params)) as SourceResult<V>
		note({'ccc.source': source.name, 'ccc.source.state': result.state})
		if (result.state === 'error') throw new Error(result.error)
		return result
	})
}
