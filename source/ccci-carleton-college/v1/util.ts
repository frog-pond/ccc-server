import {htmlToMarkdown as toMarkdown} from '../../ccc-lib/html-to-markdown.js'

export function htmlToMarkdown(ctx) {
	ctx.response.body = toMarkdown(ctx.request.body.text)
}
