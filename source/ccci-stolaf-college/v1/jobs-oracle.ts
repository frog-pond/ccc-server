import {get} from '../../ccc-lib/http.js'
import {ONE_DAY} from '../../ccc-lib/constants.js'
import {cleanTextBlock, findHtmlKey, buildDetailMap} from '../../ccc-lib/html.js'
import mem from 'memoize'
import pMap from 'p-map'
import {JSDOM} from 'jsdom'
import getUrls from 'get-urls'
import type {Context} from '../../ccc-server/context.js'
import {z} from 'zod'

const GET_ONE_DAY = mem(get, {maxAge: ONE_DAY})
const GET_TWO_DAYS = mem(get, {maxAge: ONE_DAY * 2})

const baseJobsUrl = 'https://fa-ewur-saasfaprod1.fa.ocs.oraclecloud.com'
const getJobsUrl = () => new URL(`${baseJobsUrl}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`)
const getShareUrl = (jobId: string) => `${baseJobsUrl}/hcmUI/CandidateExperience/en/sites/CX_1/requisitions/preview/${jobId}`

export async function jobs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	ctx.body = await getJobs()
}

export async function getJobs(): Promise<JobType[]> {
	const jobs = await fetchJobs()
	return JobSchema.array().parse(jobs)
}

export async function fetchJobs(): Promise<JobType[]> {
	const url = getJobsUrl()
	url.searchParams.set('onlyData', 'true')
	url.searchParams.set('expand', ['requisitionList.secondaryLocations', 'flexFieldsFacet.values', 'requisitionList.requisitionFlexFields'].join(','))
	url.searchParams.set('finder', 
		[
			['findReqs', 'siteNumber=CX_1'].join(';'),
			['facetsList=LOCATIONS', 'WORK_LOCATION', 'WORKPLACE_TYPES', 'TITLES', 'DESCRIPTION', 'CATEGORIES', 'ORGANIZATIONS', 'POSTING_DATES', 'FLEX_FIELDS'].join('%3B'),
			['limit=200', 'selectedPostingDatesFacet=30', 'sortBy=POSTING_DATES_DESC'].join(','),
		].join(','))

	try {
		const data = await get(url, {
			headers: {
				'Content-Type': 'application/vnd.oracle.adf.resourceitem+json;charset=utf-8',
				'Ora-Irc-Language': 'en',
				'Referer': baseJobsUrl,
			}
		})
		.then(response => response.json())
		.then(data => rootSchema.parse(data))

		if (data.items.length === 0) {
			console.error('No job data found in response')
			return []
		}

		return data.items[0]?.requisitionList.map((job) => ({
			id: job.Id,
			title: job.Title,
			// description: job.ShortDescriptionStr ?? job.ExternalDescriptionStr ?? '',
			description: job.ShortDescriptionStr ?? '',
			lastModified: job.PostedDate,
			links: [],
			// type: job.Category || 'Student Work',
			type: 'Student Work',
			url: getShareUrl(job.Id),
			// contactEmail: job.ExternalContactEmail ?? '',
			contactEmail: '',
			// contactName: job.ExternalContactName ?? '',
			contactPhone: '',
			hoursPerWeek: job.WorkHours ?? '',
			howToApply: job.ExternalResponsibilitiesStr ?? '',
			office: job.Organization ?? '',
			// openPositions: job.NumberOfOpenings ?? '',
			openPositions: '',
			skills: job.ExternalQualificationsStr ?? '',
			timeline: '',
			year: '',
		}))
	} catch (error) {
		console.error('Job fetching failed:', error)
		return []
	}
}

const requisitionListSchema = z.object({
	Id: z.string(),
	Title: z.string(),
	PostedDate: z.string(),
	PostingEndDate: z.string().nullable(),
	Language: z.string(),
	PrimaryLocationCountry: z.string(),
	GeographyId: z.number(),
	HotJobFlag: z.boolean(),
	WorkplaceTypeCode: z.string().nullable(),
	JobFamily: z.string().nullable(),
	JobFunction: z.string().nullable(),
	WorkerType: z.string().nullable(),
	ContractType: z.string().nullable(),
	ManagerLevel: z.string().nullable(),
	JobSchedule: z.string().nullable(),
	JobShift: z.string().nullable(),
	JobType: z.string().nullable(),
	StudyLevel: z.string().nullable(),
	DomesticTravelRequired: z.string().nullable(),
	InternationalTravelRequired: z.string().nullable(),
	WorkDurationYears: z.string().nullable(),
	WorkDurationMonths: z.string().nullable(),
	WorkHours: z.string().nullable(),
	WorkDays: z.string().nullable(),
	LegalEmployer: z.string().nullable(),
	BusinessUnit: z.string().nullable(),
	Department: z.string().nullable(),
	Organization: z.string().nullable(),
	MediaThumbURL: z.string().nullable(),
	ShortDescriptionStr: z.string().nullable(),
	PrimaryLocation: z.string(),
	Distance: z.number(),
	TrendingFlag: z.boolean(),
	BeFirstToApplyFlag: z.boolean(),
	Relevancy: z.number(),
	WorkplaceType: z.string(),
	ExternalQualificationsStr: z.string().nullable(),
	ExternalResponsibilitiesStr: z.string().nullable(),
	secondaryLocations: z.array(z.any()),
	requisitionFlexFields: z.array(z.any())
})

const facetSchema = z.object({
	Id: z.union([z.string(), z.number()]),
	Name: z.string(),
	TotalCount: z.number()
  })

  const itemsSchema = z.object({
	SearchId: z.number(),
	Keyword: z.string().nullable(),
	CorrectedKeyword: z.string().nullable(),
	UseExactKeywordFlag: z.boolean(),
	SuggestedKeyword: z.string().nullable(),
	ExecuteSpellCheckFlag: z.boolean(),
	Location: z.string().nullable(),
	LocationId: z.string().nullable(),
	Radius: z.number(),
	RadiusUnit: z.string(),
	SelectedTitlesFacet: z.string().nullable(),
	SelectedCategoriesFacet: z.string().nullable(),
	SelectedPostingDatesFacet: z.string().nullable(),
	SelectedLocationsFacet: z.string().nullable(),
	LastSelectedFacet: z.string().nullable(),
	Facets: z.string(),
	Offset: z.number(),
	Limit: z.number(),
	SortBy: z.string(),
	TotalJobsCount: z.number(),
	Latitude: z.string().nullable(),
	Longitude: z.string().nullable(),
	SiteNumber: z.string(),
	JobFamilyId: z.string().nullable(),
	PostingStartDate: z.string().nullable(),
	PostingEndDate: z.string().nullable(),
	SelectedWorkLocationsFacet: z.string().nullable(),
	RequisitionId: z.string().nullable(),
	CandidateNumber: z.string().nullable(),
	WorkLocationZipCode: z.string().nullable(),
	WorkLocationCountryCode: z.string().nullable(),
	SelectedFlexFieldsFacets: z.string().nullable(),
	OrganizationId: z.string().nullable(),
	SelectedOrganizationsFacet: z.string().nullable(),
	UserTargetFacetName: z.string().nullable(),
	UserTargetFacetInputTerm: z.string().nullable(),
	HotJobFlag: z.boolean().nullable(),
	WorkplaceType: z.string().nullable(),
	SelectedWorkplaceTypesFacet: z.string().nullable(),
	BotQRShortCode: z.string().nullable(),
	requisitionList: z.array(requisitionListSchema),
	categoriesFacet: z.array(facetSchema),
	locationsFacet: z.array(facetSchema),
	postingDatesFacet: z.array(facetSchema),
	titlesFacet: z.array(z.any()),
	workLocationsFacet: z.array(facetSchema),
	flexFieldsFacet: z.array(z.any()),
	organizationsFacet: z.array(facetSchema),
	workplaceTypesFacet: z.array(facetSchema)
})

const linksSchema = z.object({
	rel: z.string(),
	href: z.string(),
	name: z.string(),
	kind: z.string()
})

const rootSchema = z.object({
	items: z.array(itemsSchema),
	count: z.number(),
	hasMore: z.boolean(),
	limit: z.number(),
	offset: z.number(),
	links: z.array(linksSchema)
})

export const JobSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	contactEmail: z.string().optional(),
	contactName: z.string().optional(),
	contactPhone: z.string().optional(),
	hoursPerWeek: z.string().optional(),
	howToApply: z.string().optional(),
	lastModified: z.string(),
	links: z.array(z.string()),
	office: z.string().optional(),
	openPositions: z.string().optional(),
	skills: z.string().optional(),
	timeline: z.string().optional(),
	type: z.string(),
	url: z.string(),
	year: z.string().optional(),
})

export type JobType = z.infer<typeof JobSchema>
