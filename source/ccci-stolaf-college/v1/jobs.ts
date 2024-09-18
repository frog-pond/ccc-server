import { get } from '../../ccc-lib/http.js'
import { ONE_DAY } from '../../ccc-lib/constants.js'
import pMap from 'p-map'
import mem from 'memoize'
import { JobDetailSchema, JobsRootSchema, type JobType } from '../jobs/types.js'
import type { Context } from '../../ccc-server/context.js'

const GET_ONE_DAY = mem(get, { maxAge: ONE_DAY })

const baseJobsUrl = 'https://fa-ewur-saasfaprod1.fa.ocs.oraclecloud.com'

const getJobsUrl = () => new URL('/hcmRestApi/resources/latest/recruitingCEJobRequisitions', baseJobsUrl)
const getDetailsUrl = (jobId: string) => new URL(`/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${jobId}%22,siteNumber=CX_1`, baseJobsUrl)
const getShareUrl = (jobId: string) => new URL(`/hcmUI/CandidateExperience/en/sites/CX_1/requisitions/preview/${jobId}`, baseJobsUrl)

export async function jobs(ctx: Context) {
	ctx.cacheControl(ONE_DAY)

	const jobIds = await fetchJobIds()
	const transformedJobs = await fetchAndTransformJobDetails(jobIds)

	ctx.body = transformedJobs
}

async function fetchJobDetail(jobId: string) {
	const url = getDetailsUrl(jobId)

	try {
		const response = await GET_ONE_DAY(url)
		const data = await response.json()
		return JobDetailSchema.parse(data)
	} catch (error) {
		console.error(`Failed to fetch details for job ID ${jobId}:`, error)
		return null
	}
}

export async function fetchJobIds(): Promise<string[]> {
	const url = getJobsUrl()
	url.searchParams.set('onlyData', 'true')
	url.searchParams.set(
		'expand',
		'requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields'
	)
	url.searchParams.set(
		'finder',
		[
			['findReqs', 'siteNumber=CX_1'].join(';'),
			['facetsList=LOCATIONS', 'WORK_LOCATION', 'WORKPLACE_TYPES', 'TITLES', 'DESCRIPTION', 'CATEGORIES', 'ORGANIZATIONS', 'POSTING_DATES', 'FLEX_FIELDS'].join(';'),
			['limit=200', 'selectedPostingDatesFacet=30', 'sortBy=POSTING_DATES_DESC'].join(','),
		].join(',')
	)

	try {
		const data = await GET_ONE_DAY(url, {
			headers: {
				'Content-Type': 'application/vnd.oracle.adf.resourceitem+json;charset=utf-8',
					'Ora-Irc-Language': 'en',
				'Referer': baseJobsUrl,
			}}
		)
		.then((response) => response.json())
		.then((data) => JobsRootSchema.parse(data))

		if (data.items.length === 0) {
			console.error('No job data found in response')
			return []
		}

		return data.items[0]?.requisitionList.map((job) => job.Id) ?? []
	} catch (error) {
		console.error('Job fetching failed:', error)
		return []
	}
}

async function fetchAndTransformJobDetails(jobIds: string[]): Promise<JobType[]> {
	const jobDetails = await pMap(jobIds, fetchJobDetail, { concurrency: 4 })

	return jobDetails
	.filter((data) => data?.items?.length > 0)
	.map(({ items }) => {
		const job = items[0]

		return {
			id: job.Id,
			title: job.Title,
			description: job.ShortDescriptionStr ?? '',
			lastModified: job.PostedDate,
			type: job.Category || '',
			url: getShareUrl(job.Id).href,
			contactEmail: job.ExternalContactEmail ?? '',
			hoursPerWeek: job.WorkHours ?? '',
			howToApply: job.ExternalResponsibilitiesStr || '',
			office: job.Organization ?? '',
			openPositions: job.NumberOfOpenings ?? '',
			skills: job.skills ?? '',
			year: job.WorkYears ?? '',
		}
	})
}
