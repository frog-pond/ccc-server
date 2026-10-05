import * as Sentry from '@sentry/node'
import type {FeatureFlagsIntegration} from '@sentry/node'

/// Records a flag's value for this request with Sentry, which attaches it to
/// the active span and to any error the request reports. A no-op without the
/// FeatureFlags integration (in tests, or with no SENTRY_DSN).
export function recordFlagInSentry(name: string, value: boolean): void {
	Sentry.getClient()
		?.getIntegrationByName<FeatureFlagsIntegration>('FeatureFlags')
		?.addFeatureFlag(name, value)
}

/// A percentage from an environment variable: 0 to 100, or 0 (with a warning)
/// for anything else, so a typo turns a rollout off rather than on.
export function parsePercent(name: string, raw: string | undefined): number {
	if (raw === undefined || raw.trim() === '') return 0
	let percent = Number(raw)
	if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
		console.warn(
			`${name} should be a percentage from 0 to 100, but is ${JSON.stringify(raw)}; using 0`,
		)
		return 0
	}
	return percent
}

/// A flag that is on for `percent` of the times it is checked, chosen at
/// random each time, and recorded each time.
export function percentRollout(
	name: string,
	percent: number,
	{random = Math.random, record = recordFlagInSentry} = {},
): () => boolean {
	return () => {
		let enabled = random() * 100 < percent
		record(name, enabled)
		return enabled
	}
}
