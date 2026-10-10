/// A history kept one row per item (a post, an event, a stream, an episode),
/// in an `ArchiveDO` per feed. Items come in two ways: whatever the feed's
/// live source reads is recorded as it is read, and the archive walks the
/// feed's history on its own, a step at a time, until it reaches the start.
/// Nothing that has happened is ever removed; a future item the live read no
/// longer lists, within the span that read covers, is.

/// A span of time, in milliseconds, that a live read covers.
export type Span = {from: number; to: number}

/// One step back through a feed's history: what it found, and where the next
/// step starts, or null when there is nothing older.
export type BackfillStep<I> = {items: I[]; next: string | null}

export interface Archive<P, I> {
	/// namespace for the object id and the registry
	name: string
	/// stable identity of one feed
	key: (params: P) => string
	/// an item's identity within its feed
	id: (item: I) => string
	/// when an item happens or was published, in milliseconds
	at: (item: I) => number
	/// one step back through the feed's history, from `cursor` (null at first)
	backfill: (params: P, env: Env, cursor: string | null) => Promise<BackfillStep<I>>
}

/// Archives by name; the object is handed a name and params, never a function.
export const archives: Record<string, Archive<never, unknown>> = {}

export function registerArchive<P, I>(archive: Archive<P, I>) {
	archives[archive.name] = archive as unknown as Archive<never, unknown>
	return archive
}

const stub = <P, I>(env: Env, archive: Archive<P, I>, params: P) =>
	env.ARCHIVE.getByName(`${archive.name}:${archive.key(params)}`)

/// Records what a live read found. Future items within `span` that the read
/// did not list are removed.
export async function recordItems<P, I>(
	env: Env,
	archive: Archive<P, I>,
	params: P,
	items: I[],
	span?: Span,
): Promise<void> {
	await stub(env, archive, params).record(archive.name, params, items, span ?? null)
}

/// Up to `limit` items from before `before` (milliseconds), latest first.
export async function itemsBefore<P, I>(
	env: Env,
	archive: Archive<P, I>,
	params: P,
	before: number,
	limit: number,
): Promise<I[]> {
	let result = (await stub(env, archive, params).before(archive.name, params, before, limit)) as
		{state: 'ok'; items: unknown[]} | {state: 'error'; error: string}
	if (result.state === 'error') throw new Error(result.error)
	return result.items as I[]
}
