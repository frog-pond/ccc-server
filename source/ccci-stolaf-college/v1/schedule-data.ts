import {z} from 'zod'
import {getJson} from '../../ccc-lib/http.ts'
import {GH_PAGES} from './gh-pages.ts'

const envelope = z.object({data: z.unknown()})

/** Unwrap published JSON; the paired schedule parser validates the payload. */
export async function getScheduleData(filename: 'building-hours.json' | 'breaks.json') {
	return envelope.parse(await getJson(GH_PAGES(filename))).data
}
