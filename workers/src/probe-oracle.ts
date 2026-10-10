/// A temporary look at whether Oracle Recruiting answers this worker, before
/// the student-work source is built. It fetches only the two fixed addresses
/// below (nothing from the request) and reports how Oracle responded.

const API = 'https://fa-ewur-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest'
const SITE = 'CX_1'

const BOARD = `${API}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&fields=SearchId;requisitionList:Id&finder=findReqs;siteNumber=${SITE},limit=200`
const detail = (id: string) =>
	`${API}/recruitingCEJobRequisitionDetails?onlyData=true&expand=all&finder=ById;Id=${encodeURIComponent(id)},siteNumber=${SITE}`

type Look = {
	status: number
	ms: number
	headers: Record<string, string>
	sample: string
	body?: unknown
}

async function look(url: string): Promise<Look> {
	let started = Date.now()
	let response = await fetch(url, {redirect: 'manual'})
	let text = await response.text()
	let headers: Record<string, string> = {}
	for (let [name, value] of response.headers) {
		if (name !== 'set-cookie') headers[name] = value
	}
	let body: unknown
	try {
		body = JSON.parse(text)
	} catch {
		// not JSON: the sample below shows what came back instead
	}
	return {
		status: response.status,
		ms: Date.now() - started,
		headers,
		sample: text.slice(0, 300),
		body,
	}
}

export async function probeOracle(request: Request): Promise<Response> {
	let cf = (request as {cf?: {colo?: string}}).cf
	try {
		let board = await look(BOARD)
		let ids =
			(board.body as {items?: {requisitionList?: {Id: string}[]}[]} | undefined)?.items?.flatMap(
				(item) => item.requisitionList?.map((posting) => posting.Id) ?? [],
			) ?? []
		let first = ids[0] === undefined ? undefined : await look(detail(ids[0]))
		let strip = ({body: _body, ...rest}: Look) => rest
		return Response.json(
			{
				colo: cf?.colo ?? null,
				board: {...strip(board), postings: ids.length},
				detail: first && {id: ids[0], ...strip(first)},
			},
			{headers: {'Cache-Control': 'no-store'}},
		)
	} catch (err) {
		return Response.json(
			{colo: cf?.colo ?? null, error: err instanceof Error ? err.message : String(err)},
			{status: 502, headers: {'Cache-Control': 'no-store'}},
		)
	}
}
