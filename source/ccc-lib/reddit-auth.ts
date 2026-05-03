import {http} from './http.ts'

interface TokenResponse {
	access_token: string
	token_type: string
	expires_in: number
}

interface CachedToken {
	token: string
	expiresAt: number
}

let cached: CachedToken | null = null

/**
 * Returns an app-only OAuth bearer token for Reddit's API.
 * Reads REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET from the environment.
 * Caches the token in memory and refreshes it before expiry.
 * Returns null when credentials are not configured (unauthenticated fallback).
 */
export async function getRedditToken(): Promise<string | null> {
	const clientId = process.env['REDDIT_CLIENT_ID']
	const clientSecret = process.env['REDDIT_CLIENT_SECRET']

	if (!clientId || !clientSecret) return null

	const now = Date.now()
	if (cached && now < cached.expiresAt) {
		return cached.token
	}

	const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
	const response = await http
		.post('https://www.reddit.com/api/v1/access_token', {
			headers: {Authorization: `Basic ${credentials}`},
			body: new URLSearchParams({grant_type: 'client_credentials'}),
		})
		.json<TokenResponse>()

	// Refresh 5 minutes before expiry
	cached = {
		token: response.access_token,
		expiresAt: now + (response.expires_in - 300) * 1000,
	}

	return cached.token
}
