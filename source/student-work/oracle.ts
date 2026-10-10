import {z} from 'zod'
import {getJson} from '../ccc-lib/http.ts'
import {API, LIMIT, SITE, query} from './oracle-shape.ts'
import {unitNumberOfDescription} from './unit-number.ts'

const BoardSchema = z.object({
	items: z.array(z.object({requisitionList: z.array(z.object({Id: z.string()}))})).min(1),
})

const DetailSchema = z.object({
	items: z.array(z.object({ExternalDescriptionStr: z.string().nullish()})).min(1),
})

export async function boardIds(): Promise<string[]> {
	let params = query([
		['onlyData', 'true'],
		['expand', 'requisitionList'],
		['fields', 'SearchId;requisitionList:Id'],
		['finder', `findReqs;siteNumber=${SITE},limit=${LIMIT}`],
	])
	let body = BoardSchema.parse(await getJson(`${API}/recruitingCEJobRequisitions?${params}`))
	return body.items.flatMap((item) => item.requisitionList.map((posting) => posting.Id))
}

export async function unitOf(id: string): Promise<string | null> {
	let params = query([
		['onlyData', 'true'],
		['expand', 'all'],
		['finder', `ById;Id=${id},siteNumber=${SITE}`],
	])
	let body = DetailSchema.parse(await getJson(`${API}/recruitingCEJobRequisitionDetails?${params}`))
	return unitNumberOfDescription(body.items[0]?.ExternalDescriptionStr ?? '')
}
