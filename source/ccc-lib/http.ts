import ky, {type Input, type Options} from 'ky'

export const USER_AGENT = 'ccc-server/0.2.0'

export const http = ky.extend({
	headers: {'User-Agent': USER_AGENT},
	timeout: 30_000,
})

export const getText = (input: Input, options?: Options) => http.get(input, options).text()
export const getJson = <T = unknown>(input: Input, options?: Options) =>
	http.get(input, options).json<T>()
