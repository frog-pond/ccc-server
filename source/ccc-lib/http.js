import ky from 'ky'
import memoize from 'memoize'
import {ONE_MINUTE} from './constants.js'

export const USER_AGENT = 'ccc-server/0.2.0'

export const http = ky.extend({
	headers: {'User-Agent': USER_AGENT},
	timeout: 30_000,
	// hooks: {
	// 	beforeRequest: [
	// 		(request) => {
	// 			console.log(`${request.method} ${request.url}`)
	// 		},
	// 	],
	// 	afterResponse: [
	// 		(_request, _, response) => {
	// 			console.log(`got ${response.url}`)
	// 		},
	// 	],
	// },
})

/**
 *
 * @param {string|URL} url
 * @param {import("ky").Options} [opts]
 * @returns {import("ky").ResponsePromise}
 */
export const get = memoize(http.get, {maxAge: ONE_MINUTE})
