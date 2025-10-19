// vendored from https://github.com/koajs/ctx-cache-control/tree/8040ea7f94b0d5fa2c194694afcc714c2bdacd4e

import type Koa from 'koa'

declare module 'koa' {
	interface ExtendableContext {
		cacheControl: (maxAge: number | string | false) => void
	}
}

export function ctxCacheControl(app: Koa) {
	app.context['cacheControl'] = function cacheControl(maxAge: number | string | false): void {
		if (maxAge === false) {
			this.set('Cache-Control', 'private, no-cache, no-store')
			return
		}

		if (typeof maxAge === 'number') {
			maxAge = Math.round(maxAge / 1000)
			this.set('Cache-Control', `public, max-age=${maxAge.toFixed(0)}`)
		} else if (typeof maxAge === 'string') {
			this.set('Cache-Control', maxAge)
		} else {
			throw new Error('invalid cache control value: ' + (maxAge as unknown as string))
		}
	}

	return app
}
