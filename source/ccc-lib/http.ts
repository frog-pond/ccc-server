import ky, {type AfterResponseHook, type BeforeRequestHook} from 'ky'
import {ONE_MINUTE} from './constants.js'
import {safeResponse} from '../ccc-server/instrument.js'

export const USER_AGENT = 'ccc-server/0.2.0'

const IS_DEBUG_KY = process.env['TRACE']?.split(',').includes('ky')

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

// ensures Response objects are properly handled when memoized and consumed multiple times
export const get = safeResponse(http.get, {maxAge: ONE_MINUTE})
