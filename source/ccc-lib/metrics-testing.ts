import * as Sentry from '@sentry/node'
import type {Metric} from '@sentry/node'

/// Attributes the SDK adds to every metric, which tests don't care about
const SDK_ATTRIBUTES = /^sentry\.|^server\.address$/u

/// Starts a Sentry client that sends nothing, and returns the metrics it is
/// asked to send, as they are asked. For tests: each test file runs in a
/// process of its own, so the client lasts only as long as that file.
export function captureMetrics(): Metric[] {
	let seen: Metric[] = []
	Sentry.init({
		dsn: 'http://key@127.0.0.1:9/1',
		defaultIntegrations: false,
		beforeSendMetric(metric) {
			seen.push(metric)
			return null
		},
	})
	return seen
}

/// The captured metrics named `name`, as [value, attributes] pairs without the
/// SDK's own attributes, clearing them from `seen`.
export function takeMetrics(seen: Metric[], name: string): [number, Record<string, unknown>][] {
	let taken = seen.filter((m) => m.name === name)
	seen.splice(0, seen.length, ...seen.filter((m) => m.name !== name))
	return taken.map((m) => [
		m.value,
		Object.fromEntries(
			Object.entries(m.attributes ?? {}).filter(([key]) => !SDK_ATTRIBUTES.test(key)),
		),
	])
}
