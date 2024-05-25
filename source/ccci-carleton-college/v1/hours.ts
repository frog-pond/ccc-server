import {get} from '../../ccc-lib/http.js'
import {GH_PAGES} from './gh-pages.js'
import {z} from 'zod'
import {createRouteSpec} from 'koa-zod-router'

const LinkSchema = z.object({
	title: z.string(),
	url: z.string().url(),
})

const ScheduleBlockSchema = z.object({
	days: z.union([
		z.literal('Mo'),
		z.literal('Tu'),
		z.literal('We'),
		z.literal('Th'),
		z.literal('Fr'),
		z.literal('Sa'),
		z.literal('Su'),
	]),
	from: z.string().regex(/^1?\d:[0-5]?\d[ap]m$/),
	to: z.string().regex(/^1?\d:[0-5]?\d[ap]m$/),
})

const ScheduleSchema = z.object({
	title: z.string(),
	notes: z.string().optional(),
	closedForChapelTime: z.boolean().optional(),
	isPhysicallyOpen: z.boolean().optional(),
	hours: ScheduleBlockSchema.array(),
})

const BuildingHoursSchema = z.object({
	name: z.string(),
	subtitle: z.string().optional(),
	abbreviation: z.string().optional(),
	category: z.string(),
	image: z.string().optional(),
	isNotice: z.boolean().optional(),
	noticeMessage: z.string().optional(),
	schedule: ScheduleSchema.array(),
	links: LinkSchema.array(),
})

const ResponseSchema = z.object({
	data: BuildingHoursSchema.array(),
})

export async function getBuildingHours() {
	return ResponseSchema.parse(await get(GH_PAGES('building-hours.json')).json())
}

export const getBuildingHoursRoute = createRouteSpec({
	method: 'get',
	path: '/spaces/hours',
	validate: {response: ResponseSchema},
	handler: async (ctx) => {
		ctx.body = await getBuildingHours()
	},
})
