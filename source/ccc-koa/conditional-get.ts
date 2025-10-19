// vendored from https://github.com/koajs/conditional-get/tree/a4d1a0f5d9cfb6f9fcf3baab54dbd5ca17611cda
import type {Context, Next} from 'koa'

export function conditionalGet() {
	return async function conditionalGet(ctx: Context, next: Next) {
		await next()

		if (ctx.fresh) {
			ctx.status = 304
			ctx.body = null
		}
	}
}
