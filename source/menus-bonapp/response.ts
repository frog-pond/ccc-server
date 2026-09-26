import type {Context} from '../ccc-worker/env.ts'
import type {BonAppResult} from './index.ts'

/// Answers with BonApp data. A stand-in for an unreachable BonApp is marked
/// no-store, so the edge cache doesn't keep serving an outage for the route's
/// whole TTL after BonApp recovers.
export function bonAppJson(c: Context, result: BonAppResult<unknown>) {
	if (result.fallback) {
		c.header('Cache-Control', 'no-store')
	}
	return c.json(result.data)
}
