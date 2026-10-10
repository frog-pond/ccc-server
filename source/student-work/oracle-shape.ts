import {z} from 'zod'

/// Where St. Olaf's Oracle Recruiting lives. Every address below is built from
/// these, so nothing else can be fetched through them.
export const ORACLE_ORIGIN = 'https://fa-ewur-saasfaprod1.fa.ocs.oraclecloud.com'
export const API = `${ORACLE_ORIGIN}/hcmRestApi/resources/latest`
/// St. Olaf's Candidate Experience site.
export const SITE = 'CX_1'
/// The public site a student applies on.
export const SITE_URL = `${ORACLE_ORIGIN}/hcmUI/CandidateExperience/en/sites/${SITE}`

/// Every posting the board lists, well under this.
export const LIMIT = '200'

/// Built by hand, not with URLSearchParams, which encodes the finder's `;` and
/// `,` separators differently.
export function query(params: [string, string][]): string {
	return params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
}

/// The board with each posting's title, date and location.
export function boardUrl(): string {
	let params = query([
		['onlyData', 'true'],
		['expand', 'requisitionList'],
		['finder', `findReqs;siteNumber=${SITE},limit=${LIMIT},sortBy=POSTING_DATES_DESC`],
	])
	return `${API}/recruitingCEJobRequisitions?${params}`
}

/// Oracle's ids are digits; anything else is not one to build an address from.
const PostingId = z.string().regex(/^\d{1,12}$/u)

export function detailUrl(id: string): string {
	let params = query([
		['onlyData', 'true'],
		['expand', 'all'],
		['finder', `ById;Id=${PostingId.parse(id)},siteNumber=${SITE}`],
	])
	return `${API}/recruitingCEJobRequisitionDetails?${params}`
}

/// The page a student reads and applies on.
export function jobPageUrl(id: string): string {
	return `${SITE_URL}/job/${PostingId.parse(id)}`
}

/// One posting as the board lists it.
export interface BoardPosting {
	id: string
	title: string
	/// YYYY-MM-DD, as Oracle publishes it, with no zone
	postedDate: string
	location: string | null
}

const BoardSchema = z.object({
	items: z
		.array(
			z.object({
				requisitionList: z.array(
					z.object({
						Id: PostingId,
						Title: z.string(),
						PostedDate: z.string(),
						PrimaryLocation: z.string().nullish(),
					}),
				),
			}),
		)
		.min(1),
})

/// The board's postings. Throws on anything that is not Oracle's board.
export function boardPostings(body: unknown): BoardPosting[] {
	return BoardSchema.parse(body).items.flatMap((item) =>
		item.requisitionList.map((posting) => ({
			id: posting.Id,
			title: posting.Title,
			postedDate: posting.PostedDate,
			location: posting.PrimaryLocation ?? null,
		})),
	)
}

/// What a posting's detail says beyond the board.
export interface OracleDetail {
	id: string
	title: string
	category: string | null
	schedule: string | null
	requisitionType: string | null
	location: string | null
	workplaceType: string | null
	/// when it went up, with a zone
	postedAt: string | null
	/// when it comes down, when Oracle says
	endsAt: string | null
	/// the description as the editor wrote it, in HTML
	descriptionHtml: string
}

const text = z
	.string()
	.nullish()
	.transform((value) => (value?.length ? value : null))

const DetailSchema = z.object({
	items: z
		.array(
			z.object({
				Id: PostingId,
				Title: z.string(),
				Category: text,
				JobSchedule: text,
				RequisitionType: text,
				PrimaryLocation: text,
				WorkplaceType: text,
				ExternalPostedStartDate: text,
				ExternalPostedEndDate: text,
				ExternalDescriptionStr: z.string().nullish(),
			}),
		)
		.min(1),
})

/// A posting's detail. Throws on anything that is not Oracle's detail.
export function oracleDetail(body: unknown): OracleDetail {
	let [posting] = DetailSchema.parse(body).items
	if (!posting) throw new Error('no posting in the detail')
	return {
		id: posting.Id,
		title: posting.Title,
		category: posting.Category,
		schedule: posting.JobSchedule,
		requisitionType: posting.RequisitionType,
		location: posting.PrimaryLocation,
		workplaceType: posting.WorkplaceType,
		postedAt: posting.ExternalPostedStartDate,
		endsAt: posting.ExternalPostedEndDate,
		descriptionHtml: posting.ExternalDescriptionStr ?? '',
	}
}
