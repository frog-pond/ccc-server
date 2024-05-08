import isAbsoluteUrl from 'is-absolute-url'
import normalizeUrl from 'normalize-url'

function getBaseUrl(urlStr: string): string {
	// removes everything but the base url
	let urlObj = new URL(urlStr)
	if (!urlObj.hostname && !urlObj.pathname) {
		throw new Error('Invalid URL')
	}
	urlObj.pathname = ''
	urlObj.hash = ''
	urlObj.search = ''
	return urlObj.toString()
}

export function makeAbsoluteUrl(urlStr: string, {baseUrl = ''} = {}) {
	if (!isAbsoluteUrl(urlStr)) {
		baseUrl = getBaseUrl(baseUrl)
		urlStr = `${baseUrl}${urlStr}`
	}
	return normalizeUrl(urlStr, {stripWWW: false, stripHash: false})
}
