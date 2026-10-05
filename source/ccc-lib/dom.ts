import {DOMParser, parseHTML} from 'linkedom'

/// The one place that knows which DOM library we use. linkedom builds a
/// document several times faster than jsdom and runs no scripts, which is all
/// the scrapers need.
///
/// linkedom splits text at each entity ("a &amp; b" is three text nodes),
/// which jsdom does not, and code that reads nodes one at a time (as
/// `buildDetailMap` does) would see the pieces. Every document is merged back
/// into whole runs of text before it is handed out. linkedom's `normalize()`
/// merges only an element's own children, so it is called on each element.

function mergeText<T extends Document | Element>(root: T): T {
	if ('normalize' in root) root.normalize()
	for (let element of root.querySelectorAll('*')) {
		element.normalize()
	}
	return root
}

export function parseHtml(body: string): Document {
	return mergeText(parseHTML(body).document)
}

export function parseXml(body: string): Document {
	// linkedom's XMLDocument type doesn't declare the HTML-only Document members
	return mergeText(new DOMParser().parseFromString(body, 'text/xml') as unknown as Document)
}

/// An element holding `html`'s nodes, to walk or read without a page around it.
/// It is the body of a document of its own, parsed inertly.
export function htmlFragment(html: string): HTMLElement {
	let doc = new DOMParser().parseFromString(
		`<!doctype html><html><head></head><body>${html}</body></html>`,
		'text/html',
	) as unknown as Document
	return mergeText(doc.body)
}

/// The text a reader would see: tags removed, entities decoded, trimmed.
export function textFromHtml(html: string): string {
	return htmlFragment(html).textContent.trim()
}
