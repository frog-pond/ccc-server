/// Secrets are set on the worker, not in wrangler.jsonc, so `wrangler types`
/// does not know them.
interface Env {
	/** the key the Google calendar routes read the Calendar API with */
	GOOGLE_CALENDAR_API_KEY?: string
}
