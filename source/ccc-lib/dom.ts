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
/// It is the body of a document of its own, parsed inertly. linkedom splits
/// text at each entity ("a &amp; b" is three nodes), which jsdom does not, so
/// the text is merged back: callers read top-level nodes as whole runs of text.
export function htmlFragment(html: string): HTMLElement {
	let doc = new DOMParser().parseFromString(
		`<!doctype html><html><head></head><body>${html}</body></html>`,
		'text/html',
	) as unknown as Document
	doc.body.normalize()
	return doc.body
}

/// The text a reader would see: tags removed, entities decoded, trimmed.
export function textFromHtml(html: string): string {
	return htmlFragment(html).textContent.trim()
}
