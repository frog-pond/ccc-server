import ky from 'ky'
import memoize from 'memoize'
import {ONE_MINUTE} from './constants.js'

export const USER_AGENT = 'ccc-server/0.2.0'

export const http = ky.extend({
	headers: {
		'User-Agent': USER_AGENT,
	},
	timeout: 30_000,
})

/**
 *
 * @param {string|URL} url
 * @param {import("ky").Options} [opts]
 * @returns {import("ky").ResponsePromise}
 */
export const get = memoize(http.get, {maxAge: ONE_MINUTE})
