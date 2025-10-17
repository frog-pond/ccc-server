import {htmlToMarkdown as toMarkdown} from '../../ccc-lib/html-to-markdown.ts'
import type {Context} from '../../ccc-server/context.ts'

export function htmlToMarkdown(ctx: Context) {
	ctx.assert(
		typeof ctx.request.body === 'object' &&
			ctx.request.body &&
			'text' in ctx.request.body &&
			typeof ctx.request.body.text === 'string',
		400,
		'request body .text property is required',
	)
	ctx.response.body = toMarkdown(ctx.request.body.text)
}
