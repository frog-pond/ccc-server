import {DOMParser, parseHTML} from 'linkedom'

/// jsdom cannot run on Workers (it reads a stylesheet from disk at load time),
/// and HTMLRewriter parses everything as HTML, which loses RSS <link> text. This
/// is the one place that knows which DOM library we use.

export function parseHtml(body: string): Document {
	return parseHTML(body).document
}

export function parseXml(body: string): Document {
	// linkedom's XMLDocument type doesn't declare the HTML-only Document members
	return new DOMParser().parseFromString(body, 'text/xml') as unknown as Document
}

/// The text a reader would see: tags removed, entities decoded, trimmed.
export function textFromHtml(html: string): string {
	let container = parseHtml('<html><body></body></html>').createElement('div')
	container.innerHTML = html
	return container.textContent.trim()
}
