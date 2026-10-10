import Turndown from 'turndown'
import {makeAbsoluteUrl} from './url.ts'

interface TurndownOptions {
	baseUrl?: string
}

function turndown(content: string | HTMLElement, {baseUrl = ''}: TurndownOptions = {}): string {
	let t = new Turndown({
		headingStyle: 'atx',
		hr: '---',
		bulletListMarker: '-',
	})

	t.addRule('absolute-urls', {
		filter(node, options) {
			return (
				options.linkStyle === 'inlined' &&
				node.nodeName === 'A' &&
				Boolean(node.getAttribute('href'))
			)
		},

		replacement(content, node) {
			if (!('getAttribute' in node)) {
				return ''
			}

			let href = node.getAttribute('href')
			if (!href) {
				return ''
			}

			href = makeAbsoluteUrl(href, {baseUrl})

			let title = node.getAttribute('title')
			title = title ? ` "${title}"` : ''

			return `[${content}](${href}${title})`
		},
	})

	return t.turndown(content)
}

/// Markdown for HTML, given as a string or as an element already parsed (with
/// linkedom, say), which needs no DOM of turndown's own to read.
export function htmlToMarkdown(htmlStr: string | HTMLElement, opts?: TurndownOptions) {
	return turndown(htmlStr, opts)
}
