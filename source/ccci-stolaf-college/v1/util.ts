import {htmlToMarkdown} from '../../ccc-lib/html-to-markdown.js'
import {createRouteSpec} from 'koa-zod-router'
import {z} from 'zod'

export const htmlToMarkdownRoute = createRouteSpec({
	method: 'post',
	path: '/util/html-to-md',
	validate: {
		body: z.object({text: z.string()}),
		response: z.string(),
	},
	handler: (ctx) => {
		ctx.body = htmlToMarkdown(ctx.request.body.text)
	},
})
