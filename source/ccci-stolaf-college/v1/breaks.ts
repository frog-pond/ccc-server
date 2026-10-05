import type {Context} from '../../ccc-server/context.ts'
import {getScheduleSnapshot} from './schedule-data.ts'

export async function breaks(ctx: Context) {
	ctx.body = (await getScheduleSnapshot(ctx)).calendar
}
