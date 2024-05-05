import {fromHtml} from '../../ccc-markdown/index.js'

export function htmlToMarkdown(ctx) {
	ctx.response.body = fromHtml(ctx.request.body.text)
}
