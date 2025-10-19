import {htmlToMarkdown as toMarkdown} from '../../ccc-lib/html-to-markdown.ts'
import type {Context} from '../../ccc-server/context.ts'

export async function htmlToMarkdown(ctx: Context) {
	ctx.assert(ctx.request.is('json'), 415)

	const body: unknown = await ctx.request.json('100kb')

	ctx.assert(
		body && typeof body === 'object' && 'text' in body && typeof body.text === 'string',
		400,
		'request body .text property is required',
	)

	ctx.response.body = toMarkdown(body.text)
}
