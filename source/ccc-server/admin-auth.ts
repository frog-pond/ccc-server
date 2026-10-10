import {createHash, timingSafeEqual} from 'node:crypto'
import type {Context} from './context.ts'

function digest(value: string): Buffer {
	return createHash('sha256').update(value).digest()
}

/// Whether the request carries `Authorization: Bearer <ADMIN_KEY>`. Without an
/// ADMIN_KEY in the environment, no request does.
export function hasAdminKey(ctx: Pick<Context, 'get'>): boolean {
	let expected = process.env['ADMIN_KEY']
	if (!expected) return false
	let match = /^Bearer[ \t]+(\S+)\s*$/i.exec(ctx.get('Authorization'))
	if (!match?.[1]) return false
	// Equal-length digests, so the comparison takes the same time for any guess.
	return timingSafeEqual(digest(match[1]), digest(expected))
}
