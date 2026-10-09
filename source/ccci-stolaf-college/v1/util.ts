import {htmlToMarkdown as toMarkdown} from '../../ccc-lib/html-to-markdown.ts'
import type {Context} from '../../ccc-server/context.ts'
import {examples, type DeclaredHandler} from '../../ccc-server/route-inputs.ts'

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

/// The same route as a POST, declared on its own: only a POST carries the body
/// it reads, since fetch sends none with a GET.
export const htmlToMarkdownPost: DeclaredHandler = (ctx) => htmlToMarkdown(ctx)
htmlToMarkdownPost.inputs = {
	text: {...examples('<p>Hello, <b>Oles</b></p>'), in: 'body', required: true},
}
