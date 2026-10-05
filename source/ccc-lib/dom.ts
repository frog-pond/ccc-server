import {DOMParser, parseHTML} from 'linkedom'

/// The one place that knows which DOM library we use. linkedom builds a
/// document several times faster than jsdom and runs no scripts, which is all
/// the scrapers need.

export function parseHtml(body: string): Document {
	return parseHTML(body).document
}

export function parseXml(body: string): Document {
	// linkedom's XMLDocument type doesn't declare the HTML-only Document members
	return new DOMParser().parseFromString(body, 'text/xml') as unknown as Document
}

/// An element holding `html`'s nodes, to walk or read without a page around it.
export function htmlFragment(html: string): HTMLElement {
	let container = parseHtml('<html><body></body></html>').createElement('div')
	container.innerHTML = html
	return container
}

/// The text a reader would see: tags removed, entities decoded, trimmed.
export function textFromHtml(html: string): string {
	return htmlFragment(html).textContent.trim()
}
