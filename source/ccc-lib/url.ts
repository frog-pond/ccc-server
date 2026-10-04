import normalizeUrl from 'normalize-url'

/// Resolves a link against the page at `baseUrl`, the way a browser would:
/// `speaker.jpg` lands beside the page, `//cdn…` keeps its own host, and a
/// `mailto:` stays a `mailto:`. A relative link with no page to resolve it
/// against is left as written.
export function makeAbsoluteUrl(urlStr: string, {baseUrl = ''} = {}) {
	let url = URL.parse(urlStr, baseUrl || undefined)
	if (!url) {
		return urlStr
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return url.href
	}
	return normalizeUrl(url.href, {stripWWW: false, stripHash: false})
}
