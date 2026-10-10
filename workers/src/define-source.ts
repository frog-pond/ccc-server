export interface Source<P, V> {
	/** namespace for the object id and the registry */
	name: string
	/** stable identity of one upstream resource */
	key: (params: P) => string
	/** fetch and validate upstream; throw on failure */
	load: (params: P, env: Env) => Promise<V>
	/** fresh for this long (ms) */
	ttl: number
	/** after ttl, keep serving the old value for this long while refreshing, and on error */
	staleIfError: number
	/** a value is only fresh within the epoch it was loaded in, such as the campus date */
	epoch?: (now: Date) => string
}

export const defineSource = <P, V>(source: Source<P, V>) => source

export type Served<V> = {
	value: V
	fetchedAt: number
	state: 'fresh' | 'stale' | 'stale-error'
}

/// What a read returns. A failure with nothing stored is a value, not a thrown
/// error: workerd reports every exception that crosses RPC as unhandled, even
/// when the caller catches it, and an upstream being down is routine.
export type SourceResult<V> = Served<V> | {state: 'error'; error: string}
