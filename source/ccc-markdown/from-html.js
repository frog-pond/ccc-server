import Turndown from 'turndown'
import {makeAbsoluteUrl} from '../ccc-lib/index.js'

const turndown = (content, {baseUrl = ''} = {}) => {
	let t = new Turndown({
		headingStyle: 'atx',
		hr: '---',
		bulletListMarker: '-',
	})

	t.addRule('absolute-urls', {
		filter: function (node, options) {
			return (
				options.linkStyle === 'inlined' &&
				node.nodeName === 'A' &&
				node.getAttribute('href')
			)
		},

		replacement: function (content, node) {
			let href = node.getAttribute('href')
			href = makeAbsoluteUrl(href, {baseUrl})
			let title = node.title ? ` "${node.title}"` : ''
			return `[${content}](${href}${title})`
		},
	})

	return t.turndown(content)
}

export function fromHtml(htmlStr, opts) {
	return turndown(htmlStr, opts)
}
