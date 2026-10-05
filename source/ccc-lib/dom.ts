import {DOMParser, parseHTML} from 'linkedom'
import {SaxesParser} from 'saxes'

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

/// Throws a SyntaxError unless `body` is well-formed XML. linkedom parses
/// anything -- a truncated feed, an HTML error page, an empty body -- and
/// would hand those back as a document with fewer items, or none, as though
/// the feed were fine. This checks with saxes, set up as jsdom set it up, so
/// a feed fails here exactly where it failed before linkedom.
function assertWellFormedXml(body: string): void {
	let parser = new SaxesParser({xmlns: true, defaultXMLVersion: '1.0', forceXMLVersion: true})
	parser.on('doctype', (doctype) => {
		// entities a feed declares for itself, which jsdom accepted too (linkedom
		// leaves them as written, where jsdom expanded them)
		for (let [, name, value] of doctype.matchAll(/<!ENTITY ([^ ]+) "([^"]+)">/g)) {
			if (name && value && !(name in parser.ENTITIES)) parser.ENTITIES[name] = value
		}
	})
	parser.on('error', (error) => {
		throw new SyntaxError(`Malformed XML: ${error.message}`)
	})
	parser.write(body).close()
}

export function parseXml(body: string): Document {
	assertWellFormedXml(body)
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
