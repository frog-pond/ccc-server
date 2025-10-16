import ky, {type AfterResponseHook, type BeforeRequestHook} from 'ky'
import memoize from 'memoize'
import {ONE_MINUTE} from './constants.ts'

export const USER_AGENT = 'ccc-server/0.2.0'

const IS_DEBUG_KY = process.env['TRACE']?.split(',').includes('ky')

// In this case, || is actually the better choice because we
// want to handle undefined and empty string as falsey.
// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
const environment = process.env['NODE_ENV'] || 'development'

if (environment === 'development') {
	process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
}

const traceBeforeHook: BeforeRequestHook = (request) => {
	console.log(`${request.method} ${request.url}`)
}

const traceAfterHook: AfterResponseHook = (_request, _, response) => {
	console.log(`got ${response.url}`)
}

const beforeRequestHooks: BeforeRequestHook[] = IS_DEBUG_KY ? [traceBeforeHook] : []

const afterResponseHooks: AfterResponseHook[] = IS_DEBUG_KY ? [traceAfterHook] : []

export const http = ky.extend({
	headers: {'User-Agent': USER_AGENT},
	timeout: 30_000,
	hooks: {
		beforeRequest: beforeRequestHooks,
		afterResponse: afterResponseHooks,
	},
})

export const get = memoize(http.get, {maxAge: ONE_MINUTE})
