import url from 'url'
import isAbsoluteUrl from 'is-absolute-url'
import normalizeUrl from 'normalize-url'

function getBaseUrl(urlStr) {
	// removes everything but the base url
	let urlObj = url.parse(urlStr)
	if (!urlObj.hostname && !urlObj.pathname) {
		throw new Error('Invalid URL')
	}
	delete urlObj.pathname
	delete urlObj.fragment
	delete urlObj.query
	return url.format(urlObj)
}

export function makeAbsoluteUrl(urlStr, {baseUrl} = {}) {
	if (!isAbsoluteUrl(urlStr)) {
		baseUrl = getBaseUrl(baseUrl)
		urlStr = `${baseUrl}${urlStr}`
	}
	return normalizeUrl(urlStr, {removeWWW: false, removeHash: false})
}
