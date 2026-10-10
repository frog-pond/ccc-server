import {getText} from '../../ccc-lib/http.ts'
import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'
import {
	CONVOS_CALENDAR_URL,
	CONVOS_PODCAST_URL,
	archivedFrom,
	upcomingFrom,
} from './convos-shape.ts'

async function fetchUpcoming(eventId: string) {
	let body = await getText(CONVOS_CALENDAR_URL, {searchParams: {eId: eventId}})
	return upcomingFrom(body)
}

export const getUpcoming = fetchUpcoming

export async function upcomingDetail(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)
	if (ctx.cached(ONE_HOUR * 6)) return

	let {id: detailId = ''} = ctx.params
	ctx.assert(detailId, 400, 'id is required')
	ctx.body = await getUpcoming(detailId)
}

async function fetchArchived() {
	let body = await getText(CONVOS_PODCAST_URL)
	return archivedFrom(body)
}

export const getArchived = fetchArchived

export async function archived(ctx: Context) {
	ctx.cacheControl(ONE_HOUR * 6)
	if (ctx.cached(ONE_HOUR * 6)) return

	ctx.body = await getArchived()
}
