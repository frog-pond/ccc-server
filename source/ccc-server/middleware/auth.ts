import type {Context} from '../context.ts'
import type {Next} from 'koa'

export async function verifyRestartToken(ctx: Context, next: Next): Promise<void> {
	const restartToken = process.env['RESTART_TOKEN']

	if (!restartToken) {
		ctx.status = 500
		ctx.body = {error: 'Server configuration error: RESTART_TOKEN not set'}
		return
	}

	const authHeader = ctx.request.headers.authorization
	if (!authHeader) {
		ctx.status = 401
		ctx.body = {error: 'Unauthorized: Missing authorization header'}
		return
	}

	const parts = authHeader.split(' ')
	if (parts.length !== 2 || parts[0] !== 'Bearer') {
		ctx.status = 401
		ctx.body = {error: 'Unauthorized: Invalid authorization header format'}
		return
	}

	const token = parts[1]
	if (token !== restartToken) {
		ctx.status = 401
		ctx.body = {error: 'Unauthorized: Invalid token'}
		return
	}

	// Token is valid, continue to next middleware
	await next()
}
