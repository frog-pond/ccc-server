import * as Sentry from '@sentry/node'

/// How many items one load of a feed gave. A scraper whose upstream changes
/// shape tends not to throw but to read nothing, so this is where that shows:
/// as a feed whose count drops to zero and stays there.
export function recordFeedItems(
	source: string,
	feed: string,
	count: number,
	attributes: Record<string, string | boolean> = {},
): void {
	Sentry.metrics.gauge('feed.items', count, {attributes: {...attributes, source, feed}})
}

/// That one load of a feed failed, whether it threw or fell back to a stand-in.
export function recordFeedFailure(source: string, feed: string): void {
	Sentry.metrics.count('feed.failure', 1, {attributes: {source, feed}})
}

/// A feed's name for a metric: its URL's host and path. Never its query,
/// which can carry an API key.
export function feedName(url: string | URL): string {
	let parsed = URL.parse(String(url))
	return parsed ? `${parsed.host}${parsed.pathname}` : 'unknown'
}
