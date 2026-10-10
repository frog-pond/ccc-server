import type {Served, Source, SourceResult} from './define-source.ts'

export async function fetchSource<P, V>(
	env: Env,
	source: Source<P, V>,
	params: P,
): Promise<Served<V>> {
	let stub = env.SOURCE.getByName(`${source.name}:${source.key(params)}`)
	let result = (await stub.get(source.name, params)) as SourceResult<V>
	if (result.state === 'error') throw new Error(result.error)
	return result
}
