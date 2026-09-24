import type {Context as HonoContext} from 'hono'

/// Bindings each Worker gets: INSTITUTION from wrangler.toml vars, the API key
/// from `wrangler secret put` (or .dev.vars locally).
export interface Env {
	INSTITUTION: string
	GOOGLE_CALENDAR_API_KEY: string
}

export interface AppEnv {
	Bindings: Env
}

export type Context = HonoContext<AppEnv>
