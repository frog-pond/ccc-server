import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'

export const SendEmailButtonSchema = z.object({
	action: z.literal('send-email'),
	title: z.string(),
	icon: z.string(),
	enabled: z.boolean().optional(),
	params: z.object({
		to: z.union([z.string(), z.array(z.string())]),
		cc: z.union([z.string(), z.array(z.string())]).optional(),
		bcc: z.union([z.string(), z.array(z.string())]).optional(),
		subject: z.string(),
		body: z.string(),
	}),
})

export const OpenUrlButtonSchema = z.object({
	action: z.literal('open-url'),
	title: z.string(),
	icon: z.string(),
	enabled: z.boolean().optional(),
	params: z.object({url: z.string().url()}),
})

export const CallPhoneButtonSchema = z.object({
	action: z.literal('call-phone'),
	title: z.string(),
	icon: z.string(),
	enabled: z.boolean().optional(),
	params: z.object({number: z.string().min(1)}),
})

export const CustomButtonSchema = z.object({
	action: z.literal('custom'),
	title: z.string(),
	enabled: z.boolean().optional(),
	params: z.record(z.string(), z.unknown()),
})

export const ToolButtonSchema = z.union([
	SendEmailButtonSchema,
	OpenUrlButtonSchema,
	CallPhoneButtonSchema,
	CustomButtonSchema,
])

export const ToolSchema = z.object({
	key: z.string(),
	title: z.string(),
	body: z.string(),
	buttons: ToolButtonSchema.array(),
	enabled: z.boolean().optional(),
	hidden: z.boolean().optional(),
	message: z.string().optional(),
	versionRange: z.string().optional(),
})

type ResponseType = z.infer<typeof ResponseSchema>
const ResponseSchema = z.object({
	data: ToolSchema.array(),
})

export async function getHelp(): Promise<ResponseType> {
	return ResponseSchema.parse(await get(GH_PAGES('help.json')).json())
}

export const getHelpRoute = createRouteSpec({
	method: 'get',
	path: '/tools/help',
	validate: {response: ResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getHelp()
	},
})
