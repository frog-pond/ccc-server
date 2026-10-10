import type {Source} from './define-source.ts'

/// Sources by name; the object is handed a name and params, never a function.
export const registry: Record<string, Source<never, unknown>> = {}

export function registerSource<P, V>(source: Source<P, V>) {
	registry[source.name] = source as unknown as Source<never, unknown>
}
