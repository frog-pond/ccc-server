import ky from 'ky'

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
export const get = (url, opts) => http.get(url, opts)
