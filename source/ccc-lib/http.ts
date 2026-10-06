import ky, {type AfterResponseHook, type BeforeRequestHook, type Input, type Options} from 'ky'

export const USER_AGENT = 'ccc-server/0.2.0'

const IS_DEBUG_KY = process.env['TRACE']?.split(',').includes('ky')

const traceBeforeHook: BeforeRequestHook = ({request}) => {
	console.log(`${request.method} ${request.url}`)
}

const traceAfterHook: AfterResponseHook = ({response}) => {
	console.log(`got ${response.url}`)
}

const beforeRequestHooks: BeforeRequestHook[] = IS_DEBUG_KY ? [traceBeforeHook] : []

const afterResponseHooks: AfterResponseHook[] = IS_DEBUG_KY ? [traceAfterHook] : []

/// The longest any one call may take, retries and the waits between them
/// included. ky applies it to the body read of `getText` and `getJson` too;
/// a caller reading a raw response's body itself passes it as a `signal`.
export const TOTAL_TIMEOUT = 60_000

export const http = ky.extend({
	headers: {'User-Agent': USER_AGENT},
	timeout: 30_000,
	totalTimeout: TOTAL_TIMEOUT,
	hooks: {
		beforeRequest: beforeRequestHooks,
		afterResponse: afterResponseHooks,
	},
})

export const getText = (input: Input, options?: Options) => http.get(input, options).text()
export const getJson = <T = unknown>(input: Input, options?: Options) =>
	http.get(input, options).json<T>()
