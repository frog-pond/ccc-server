import {tracing} from 'cloudflare:workers'

/// What the runtime cannot see for itself, noted on the span running now
/// (https://developers.cloudflare.com/workers/observability/traces/). The
/// runtime already traces each upstream fetch with its status, each Durable
/// Object call and each SQL query; these say which campus, which source, and
/// how its value was served. Nothing here names a person: there is no one to
/// name. When the request is not traced, or nothing is running, it does nothing.
export function note(attributes: Record<string, string | number | boolean | undefined>): void {
	tracing.getActiveSpan()?.setAttributes(attributes)
}

/// Runs `work` in a span of its own, which the Durable Object call inside it
/// nests under.
export function inSpan<T>(name: string, work: () => Promise<T>): Promise<T> {
	return tracing.enterSpan(name, () => work())
}
