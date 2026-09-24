import {HTTPException} from 'hono/http-exception'
import {htmlToMarkdown as toMarkdown} from '../../ccc-lib/html-to-markdown.ts'
import type {Context} from '../../ccc-worker/env.ts'

export async function htmlToMarkdown(c: Context) {
	if (!c.req.header('content-type')?.includes('application/json')) {
		throw new HTTPException(415, {message: 'Unsupported Media Type'})
	}

	const body: unknown = await c.req.json()

	if (!(body && typeof body === 'object' && 'text' in body && typeof body.text === 'string')) {
		throw new HTTPException(400, {message: 'request body .text property is required'})
	}

	return c.text(toMarkdown(body.text))
}
